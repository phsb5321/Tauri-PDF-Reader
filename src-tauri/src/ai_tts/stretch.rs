//! Pitch-preserving playback speed (spec 039).
//!
//! rodio's `Sink::set_speed` resamples — it changes pitch with tempo (chipmunk).
//! This module decouples the two: `StretchSource` wraps an audio source and runs
//! it through `signalsmith-stretch` (a time-stretch DSP) so playback can run at
//! 0.5×–4.5× while the voice keeps its **original pitch**. The trick is that the
//! wrapper reports the *source's own* sample rate, so rodio plays the stretched
//! samples back at the native rate — pitch untouched, only duration changes.

use rodio::Source;
use signalsmith_stretch::Stretch;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// Supported playback-speed band. 1.0 = normal; >1 faster, <1 slower.
pub const MIN_SPEED: f32 = 0.5;
pub const MAX_SPEED: f32 = 4.5;

/// Input frames pulled from the inner source per refill.
const BLOCK: usize = 2048;

/// Clamp a requested speed into the supported band; NaN → 1.0.
pub fn clamp_speed(speed: f32) -> f32 {
    if speed.is_nan() {
        1.0
    } else {
        speed.clamp(MIN_SPEED, MAX_SPEED)
    }
}

/// Shared, lock-free playback-speed handle. Written by `AudioSink::set_speed`
/// (the control surface) and read by `StretchSource` on every refill, so a speed
/// change applies live mid-playback without restarting the clip. Stored as the
/// bit pattern of a clamped `f32` in an `AtomicU32` — no lock, so it never blocks
/// the audio thread (keeps the player's no-lock-across-`sleep_until_end` rule).
#[derive(Clone)]
pub struct SpeedRatio(Arc<AtomicU32>);

impl SpeedRatio {
    pub fn new(speed: f32) -> Self {
        Self(Arc::new(AtomicU32::new(clamp_speed(speed).to_bits())))
    }
    pub fn get(&self) -> f32 {
        f32::from_bits(self.0.load(Ordering::Relaxed))
    }
    pub fn set(&self, speed: f32) {
        self.0
            .store(clamp_speed(speed).to_bits(), Ordering::Relaxed);
    }
}

impl Default for SpeedRatio {
    fn default() -> Self {
        Self::new(1.0)
    }
}

/// A `rodio::Source` that time-stretches its inner source to the current
/// `SpeedRatio` while preserving pitch.
pub struct StretchSource<S: Source<Item = f32>> {
    inner: S,
    speed: SpeedRatio,
    stretch: Stretch,
    channels: u16,
    sample_rate: u32,
    /// Interleaved input scratch reused per refill.
    in_scratch: Vec<f32>,
    /// Produced output samples awaiting yield (interleaved).
    out_buf: VecDeque<f32>,
    /// Cumulative input frames consumed from `inner`.
    in_frames: u64,
    /// Cumulative output frames produced. Kept ≈ `in_frames / speed` so total
    /// duration scales by 1/speed (the cumulative target absorbs the stretcher's
    /// latency instead of leaking it as a length error).
    out_frames: u64,
    inner_done: bool,
    finished: bool,
}

impl<S: Source<Item = f32>> StretchSource<S> {
    pub fn new(inner: S, speed: SpeedRatio) -> Self {
        let channels = inner.channels().max(1);
        let sample_rate = inner.sample_rate();
        let stretch = Stretch::preset_default(channels as u32, sample_rate);
        Self {
            inner,
            speed,
            stretch,
            channels,
            sample_rate,
            in_scratch: Vec::with_capacity(BLOCK * channels as usize),
            out_buf: VecDeque::new(),
            in_frames: 0,
            out_frames: 0,
            inner_done: false,
            finished: false,
        }
    }

    #[inline]
    fn is_unity(speed: f32) -> bool {
        (speed - 1.0).abs() < f32::EPSILON
    }

    /// Cumulative output-frame target for the input consumed so far at `speed`.
    fn target_out(&self, speed: f32) -> u64 {
        (self.in_frames as f64 / speed as f64).round() as u64
    }

    /// Pull one input block and stretch it (or pass through at 1×).
    fn refill(&mut self) {
        let ch = self.channels as usize;
        let speed = self.speed.get();

        // 1× = transparent bypass: no DSP, no added latency (FR-003 / SC-003).
        if Self::is_unity(speed) {
            for _ in 0..BLOCK * ch {
                match self.inner.next() {
                    Some(s) => self.out_buf.push_back(s),
                    None => {
                        self.inner_done = true;
                        return;
                    }
                }
            }
            return;
        }

        // Read up to BLOCK whole frames.
        self.in_scratch.clear();
        let mut frames = 0usize;
        'block: for _ in 0..BLOCK {
            for _ in 0..ch {
                match self.inner.next() {
                    Some(s) => self.in_scratch.push(s),
                    None => {
                        self.inner_done = true;
                        // Drop any partial (sub-frame) tail to keep frame alignment.
                        self.in_scratch.truncate(frames * ch);
                        break 'block;
                    }
                }
            }
            frames += 1;
        }
        if frames == 0 {
            self.inner_done = true;
            return;
        }
        self.in_frames += frames as u64;

        // Produce enough output to keep the cumulative total at in/speed.
        let want = self.target_out(speed).saturating_sub(self.out_frames) as usize;
        if want > 0 {
            let mut out = vec![0.0f32; want * ch];
            self.stretch.process(&self.in_scratch, &mut out);
            self.out_frames += want as u64;
            self.out_buf.extend(out);
        }
    }

    /// Drain the stretcher's buffered tail at end of input, filling exactly the
    /// remaining in/speed budget so total output ≈ in/speed (no latency leak).
    fn drain_flush(&mut self) {
        let speed = self.speed.get();
        if Self::is_unity(speed) {
            return; // bypass buffers nothing
        }
        let ch = self.channels as usize;
        let want = self.target_out(speed).saturating_sub(self.out_frames) as usize;
        if want > 0 {
            let mut out = vec![0.0f32; want * ch];
            self.stretch.flush(&mut out);
            self.out_frames += want as u64;
            self.out_buf.extend(out);
        }
    }
}

impl<S: Source<Item = f32>> Iterator for StretchSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        loop {
            if let Some(s) = self.out_buf.pop_front() {
                return Some(s);
            }
            if self.finished {
                return None;
            }
            if self.inner_done {
                self.drain_flush();
                self.finished = true;
            } else {
                self.refill();
            }
        }
    }
}

impl<S: Source<Item = f32>> Source for StretchSource<S> {
    fn current_frame_len(&self) -> Option<usize> {
        None // continuous stretched stream — no fixed span
    }
    fn channels(&self) -> u16 {
        self.channels
    }
    fn sample_rate(&self) -> u32 {
        // KEY: the source's OWN rate — rodio plays back at native pitch.
        self.sample_rate
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner
            .total_duration()
            .map(|d| Duration::from_secs_f64(d.as_secs_f64() / self.speed.get() as f64))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rodio::buffer::SamplesBuffer;
    use rodio::source::SineWave;
    use rustfft::{num_complex::Complex, FftPlanner};

    const SR: u32 = 48_000; // SineWave's native rate
    const F0: f32 = 440.0;

    fn sine_secs(seconds: f32) -> impl Source<Item = f32> {
        SineWave::new(F0).take_duration(Duration::from_secs_f32(seconds))
    }

    /// Dominant frequency (Hz) of a mono f32 signal via FFT over the largest
    /// power-of-two prefix.
    fn dominant_freq(samples: &[f32], sample_rate: u32) -> f32 {
        let len = samples.len();
        assert!(len >= 2, "need samples to analyze");
        let mut n = 1usize;
        while n * 2 <= len {
            n *= 2;
        }
        let mut buf: Vec<Complex<f32>> = samples[..n]
            .iter()
            .map(|&s| Complex { re: s, im: 0.0 })
            .collect();
        FftPlanner::new().plan_fft_forward(n).process(&mut buf);
        let (mut peak, mut mag) = (1usize, 0.0f32);
        for (k, c) in buf.iter().enumerate().take(n / 2).skip(1) {
            let m = c.norm_sqr();
            if m > mag {
                mag = m;
                peak = k;
            }
        }
        peak as f32 * sample_rate as f32 / n as f32
    }

    /// SC-001 (pitch held ≤3%) + SC-002 (duration ÷speed ≤2%) across the range.
    #[test]
    fn stretch_preserves_pitch_and_scales_duration() {
        let seconds = 2.0_f32;
        let in_frames = (seconds * SR as f32) as f64;
        for &speed in &[0.5_f32, 1.0, 2.0, 4.5] {
            let out: Vec<f32> =
                StretchSource::new(sine_secs(seconds), SpeedRatio::new(speed)).collect();

            let f = dominant_freq(&out, SR);
            assert!(
                (f - F0).abs() / F0 <= 0.03,
                "speed {speed}: dominant {f:.1}Hz vs {F0}Hz (>3% — pitch shifted)"
            );

            let expected = in_frames / speed as f64;
            let got = out.len() as f64; // mono → samples == frames
            assert!(
                (got - expected).abs() / expected <= 0.02,
                "speed {speed}: {got} frames vs expected {expected:.0} (>2% — duration off)"
            );
        }
    }

    /// SC-003: 1.0× is a bit-exact passthrough (no DSP, no latency).
    #[test]
    fn unity_ratio_is_transparent() {
        let src: Vec<f32> = sine_secs(0.5).collect();
        let out: Vec<f32> =
            StretchSource::new(SamplesBuffer::new(1, SR, src.clone()), SpeedRatio::new(1.0))
                .collect();
        assert_eq!(out, src, "1.0× must pass samples through unchanged");
    }

    /// FR-011: speed clamps to the supported band; NaN → 1.0.
    #[test]
    fn speed_ratio_clamps_to_band() {
        let r = SpeedRatio::new(10.0);
        assert_eq!(r.get(), MAX_SPEED);
        r.set(0.1);
        assert_eq!(r.get(), MIN_SPEED);
        r.set(1.5);
        assert!((r.get() - 1.5).abs() < 1e-6);
        r.set(f32::NAN);
        assert_eq!(r.get(), 1.0);
    }
}
