use rodio::{Decoder, Source};
use std::io::Cursor;

fn invalid(prefix: &str, detail: &str) -> String {
    format!("{prefix}_INVALID_WAV: {detail}")
}

fn read_u16(bytes: &[u8], at: usize, prefix: &str) -> Result<u16, String> {
    let raw: [u8; 2] = bytes
        .get(at..at + 2)
        .ok_or_else(|| invalid(prefix, "truncated u16"))?
        .try_into()
        .map_err(|_| invalid(prefix, "truncated u16"))?;
    Ok(u16::from_le_bytes(raw))
}

fn read_u32(bytes: &[u8], at: usize, prefix: &str) -> Result<u32, String> {
    let raw: [u8; 4] = bytes
        .get(at..at + 4)
        .ok_or_else(|| invalid(prefix, "truncated u32"))?
        .try_into()
        .map_err(|_| invalid(prefix, "truncated u32"))?;
    Ok(u32::from_le_bytes(raw))
}

pub(crate) fn validate_pcm16_wav(bytes: &[u8], prefix: &str) -> Result<f64, String> {
    validate_pcm16_wav_inner(bytes, prefix, false)
}

/// Groq returns a streaming WAV whose RIFF/data sizes are `u32::MAX`. Once the
/// bounded HTTP body reaches EOF, normalize those sentinels to actual sizes so
/// rodio and the disk cache receive an ordinary seekable WAV.
pub(crate) fn normalize_streaming_pcm16_wav(bytes: &mut [u8], prefix: &str) -> Result<(), String> {
    if bytes.len() < 44 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(invalid(prefix, "missing RIFF/WAVE header"));
    }
    let riff_size = u32::try_from(bytes.len() - 8)
        .map_err(|_| invalid(prefix, "response exceeds WAV size field"))?;
    if read_u32(bytes, 4, prefix)? == u32::MAX {
        bytes[4..8].copy_from_slice(&riff_size.to_le_bytes());
    }

    let mut cursor = 12_usize;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let declared = read_u32(bytes, cursor + 4, prefix)?;
        let start = cursor + 8;
        if id == b"data" && declared == u32::MAX {
            let actual = u32::try_from(bytes.len().saturating_sub(start))
                .map_err(|_| invalid(prefix, "data exceeds WAV size field"))?;
            bytes[cursor + 4..cursor + 8].copy_from_slice(&actual.to_le_bytes());
            return Ok(());
        }
        let end = start
            .checked_add(declared as usize)
            .ok_or_else(|| invalid(prefix, "chunk size overflow"))?;
        if end > bytes.len() {
            return Err(invalid(prefix, "truncated chunk"));
        }
        cursor = end + (declared as usize % 2);
        if id == b"data" {
            return Ok(());
        }
    }
    Err(invalid(prefix, "data chunk missing"))
}

pub(crate) const PCM_PROSODY_REVISION: &str = "pcm-edge-v1";
const FRAME_MS: usize = 10;
const HEAD_SAFETY_MS: usize = 50;
const MIN_TAIL_SAFETY_MS: usize = 100;

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct WavProsodyStats {
    pub activity_found: bool,
    pub leading_ms: f64,
    pub trailing_ms: f64,
    pub total_duration: f64,
}

#[derive(Debug, Clone, Copy)]
struct PcmLayout {
    channels: usize,
    sample_rate: usize,
    block_align: usize,
    data_header: usize,
    data_start: usize,
    data_end: usize,
    data_padded_end: usize,
}

fn pcm_layout(bytes: &[u8], prefix: &str) -> Result<PcmLayout, String> {
    let mut cursor = 12_usize;
    let mut format = None;
    let mut data = None;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let size = read_u32(bytes, cursor + 4, prefix)? as usize;
        let start = cursor + 8;
        let end = start
            .checked_add(size)
            .ok_or_else(|| invalid(prefix, "chunk size overflow"))?;
        let padded_end = end
            .checked_add(size % 2)
            .ok_or_else(|| invalid(prefix, "chunk padding overflow"))?;
        if padded_end > bytes.len() {
            return Err(invalid(prefix, "truncated chunk"));
        }
        if id == b"fmt " && size >= 16 {
            format = Some((
                read_u16(bytes, start + 2, prefix)? as usize,
                read_u32(bytes, start + 4, prefix)? as usize,
                read_u16(bytes, start + 12, prefix)? as usize,
            ));
        } else if id == b"data" {
            data = Some((cursor, start, end, padded_end));
        }
        cursor = padded_end;
    }
    let (channels, sample_rate, block_align) =
        format.ok_or_else(|| invalid(prefix, "fmt chunk missing"))?;
    let (data_header, data_start, data_end, data_padded_end) =
        data.ok_or_else(|| invalid(prefix, "data chunk missing"))?;
    Ok(PcmLayout {
        channels,
        sample_rate,
        block_align,
        data_header,
        data_start,
        data_end,
        data_padded_end,
    })
}

fn frame_peaks(bytes: &[u8], layout: PcmLayout) -> Vec<f64> {
    let samples_per_frame = (layout.sample_rate * FRAME_MS / 1_000).max(1);
    let audio_frames = (layout.data_end - layout.data_start) / layout.block_align;
    let mut peaks = Vec::with_capacity(audio_frames.div_ceil(samples_per_frame));
    for chunk_start in (0..audio_frames).step_by(samples_per_frame) {
        let chunk_end = (chunk_start + samples_per_frame).min(audio_frames);
        let mut peak = 0_i32;
        for frame in chunk_start..chunk_end {
            let frame_start = layout.data_start + frame * layout.block_align;
            for channel in 0..layout.channels {
                let at = frame_start + channel * 2;
                let sample = i16::from_le_bytes([bytes[at], bytes[at + 1]]) as i32;
                peak = peak.max(sample.abs());
            }
        }
        peaks.push(peak as f64 / 32_768.0);
    }
    peaks
}

fn activity_edges(peaks: &[f64]) -> Option<(usize, usize)> {
    let global_peak = peaks.iter().copied().fold(0.0_f64, f64::max);
    if global_peak <= 64.0 / 32_768.0 {
        return None;
    }
    let mut floor_samples = peaks.to_vec();
    floor_samples.sort_by(f64::total_cmp);
    let floor_index = floor_samples.len().saturating_sub(1) / 5;
    let noise_floor = floor_samples.get(floor_index).copied().unwrap_or(0.0);
    // A clip can be speech-dense enough that the 20th percentile is speech,
    // not room noise. Cap the floor contribution below the signal peak so a
    // clean, continuously voiced clip still counts as activity and receives
    // safety pads rather than being mistaken for silence.
    let relative_floor = (noise_floor * 4.0).min(global_peak * 0.25);
    let enter = (global_peak * 0.01)
        .max(relative_floor)
        .max(64.0 / 32_768.0);
    let exit = enter * 0.5;

    let mut active = false;
    let mut first = None;
    for (index, peak) in peaks.iter().copied().enumerate() {
        active = if active { peak >= exit } else { peak >= enter };
        if active {
            first.get_or_insert(index);
        }
    }

    active = false;
    let mut last = None;
    for (index, peak) in peaks.iter().copied().enumerate().rev() {
        active = if active { peak >= exit } else { peak >= enter };
        if active {
            last.get_or_insert(index);
        }
    }
    first.zip(last)
}

/// Normalize one independently synthesized PCM16 clip so two normalized clips
/// carry exactly one target boundary: this clip keeps `target - 50ms` after its
/// final activity, while the next clip keeps 50ms before its onset. Silence-only
/// input is returned unchanged because there is no safe activity edge to trim.
pub(crate) fn equalize_pcm16_wav_boundary(
    bytes: &[u8],
    target_boundary_ms: usize,
    prefix: &str,
) -> Result<(Vec<u8>, WavProsodyStats), String> {
    let original_duration = validate_pcm16_wav(bytes, prefix)?;
    if target_boundary_ms < HEAD_SAFETY_MS + MIN_TAIL_SAFETY_MS {
        return Err(invalid(prefix, "boundary target is below safety pads"));
    }
    let layout = pcm_layout(bytes, prefix)?;
    let peaks = frame_peaks(bytes, layout);
    let Some((first_active_frame, last_active_frame)) = activity_edges(&peaks) else {
        return Ok((
            bytes.to_vec(),
            WavProsodyStats {
                activity_found: false,
                leading_ms: original_duration * 1_000.0,
                trailing_ms: original_duration * 1_000.0,
                total_duration: original_duration,
            },
        ));
    };

    let samples_per_frame = (layout.sample_rate * FRAME_MS / 1_000).max(1);
    let total_frames = (layout.data_end - layout.data_start) / layout.block_align;
    let activity_start = (first_active_frame * samples_per_frame).min(total_frames);
    let activity_end = ((last_active_frame + 1) * samples_per_frame).min(total_frames);
    let desired_head = layout.sample_rate * HEAD_SAFETY_MS / 1_000;
    let desired_tail = layout.sample_rate * (target_boundary_ms - HEAD_SAFETY_MS) / 1_000;
    let source_start = activity_start.saturating_sub(desired_head);
    let source_end = (activity_end + desired_tail).min(total_frames);
    let kept_head = activity_start - source_start;
    let kept_tail = source_end - activity_end;
    let prepend_frames = desired_head - kept_head;
    let append_frames = desired_tail - kept_tail;

    let source_byte_start = layout.data_start + source_start * layout.block_align;
    let source_byte_end = layout.data_start + source_end * layout.block_align;
    let new_data_len = (prepend_frames + source_end - source_start + append_frames)
        .checked_mul(layout.block_align)
        .ok_or_else(|| invalid(prefix, "normalized data size overflow"))?;
    let new_data_len_u32 = u32::try_from(new_data_len)
        .map_err(|_| invalid(prefix, "normalized data exceeds WAV size field"))?;

    let mut output = Vec::with_capacity(
        bytes
            .len()
            .saturating_sub(layout.data_end - layout.data_start)
            .saturating_add(new_data_len),
    );
    output.extend_from_slice(&bytes[..layout.data_start]);
    output[layout.data_header + 4..layout.data_header + 8]
        .copy_from_slice(&new_data_len_u32.to_le_bytes());
    output.resize(output.len() + prepend_frames * layout.block_align, 0);
    output.extend_from_slice(&bytes[source_byte_start..source_byte_end]);
    output.resize(output.len() + append_frames * layout.block_align, 0);
    if new_data_len % 2 == 1 {
        output.push(0);
    }
    output.extend_from_slice(&bytes[layout.data_padded_end..]);
    let riff_size = u32::try_from(output.len().saturating_sub(8))
        .map_err(|_| invalid(prefix, "normalized RIFF exceeds size field"))?;
    output[4..8].copy_from_slice(&riff_size.to_le_bytes());

    let total_duration = validate_pcm16_wav(&output, prefix)?;
    Ok((
        output,
        WavProsodyStats {
            activity_found: true,
            leading_ms: desired_head as f64 * 1_000.0 / layout.sample_rate as f64,
            trailing_ms: desired_tail as f64 * 1_000.0 / layout.sample_rate as f64,
            total_duration,
        },
    ))
}

fn validate_pcm16_wav_inner(
    bytes: &[u8],
    prefix: &str,
    allow_streaming_sizes: bool,
) -> Result<f64, String> {
    if bytes.len() < 44 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(invalid(prefix, "missing RIFF/WAVE header"));
    }
    let declared_size = read_u32(bytes, 4, prefix)?;
    let streaming_riff = allow_streaming_sizes && declared_size == u32::MAX;
    if !streaming_riff && declared_size as usize + 8 != bytes.len() {
        return Err(invalid(prefix, "RIFF size does not match bytes"));
    }

    let mut cursor = 12_usize;
    let mut format = None;
    let mut data_size = None;
    let mut streaming_data = false;
    while cursor + 8 <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let declared_chunk_size = read_u32(bytes, cursor + 4, prefix)?;
        let start = cursor + 8;
        let is_streaming_data =
            allow_streaming_sizes && id == b"data" && declared_chunk_size == u32::MAX;
        let size = if is_streaming_data {
            bytes.len().saturating_sub(start)
        } else {
            declared_chunk_size as usize
        };
        let end = start
            .checked_add(size)
            .ok_or_else(|| invalid(prefix, "chunk size overflow"))?;
        if end > bytes.len() {
            return Err(invalid(prefix, "truncated chunk"));
        }
        if id == b"fmt " {
            if size < 16 {
                return Err(invalid(prefix, "short fmt chunk"));
            }
            format = Some((
                read_u16(bytes, start, prefix)?,
                read_u16(bytes, start + 2, prefix)?,
                read_u32(bytes, start + 4, prefix)?,
                read_u32(bytes, start + 8, prefix)?,
                read_u16(bytes, start + 12, prefix)?,
                read_u16(bytes, start + 14, prefix)?,
            ));
        } else if id == b"data" {
            data_size = Some(size);
            streaming_data = is_streaming_data;
        }
        cursor = end + (size % 2);
        if is_streaming_data {
            break;
        }
    }

    let (audio_format, channels, sample_rate, byte_rate, block_align, bits) =
        format.ok_or_else(|| invalid(prefix, "fmt chunk missing"))?;
    let data_size = data_size.ok_or_else(|| invalid(prefix, "data chunk missing"))?;
    if audio_format != 1 || !(1..=2).contains(&channels) || bits != 16 {
        return Err(invalid(prefix, "only mono/stereo PCM16 is supported"));
    }
    if !(8_000..=96_000).contains(&sample_rate) {
        return Err(invalid(prefix, "sample rate out of bounds"));
    }
    let expected_align = channels * (bits / 8);
    let expected_rate = sample_rate * u32::from(expected_align);
    if block_align != expected_align
        || byte_rate != expected_rate
        || data_size % usize::from(block_align) != 0
    {
        return Err(invalid(prefix, "inconsistent PCM format"));
    }

    let duration = data_size as f64 / byte_rate as f64;
    let decoder = Decoder::new(Cursor::new(bytes.to_vec()))
        .map_err(|error| invalid(prefix, &format!("rodio decode failed: {error}")))?;
    if !streaming_data {
        if let Some(decoded) = decoder.total_duration() {
            let tolerance = 1.0 / sample_rate as f64;
            if (decoded.as_secs_f64() - duration).abs() > tolerance {
                return Err(invalid(prefix, "decoded duration mismatch"));
            }
        }
    }
    Ok(duration)
}

#[cfg(test)]
pub(crate) fn fixture_pcm_wav() -> Vec<u8> {
    let sample_rate = 16_000_u32;
    let samples = vec![0_i16; 1_600];
    let data_len = (samples.len() * 2) as u32;
    let mut wav = Vec::with_capacity(44 + data_len as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    for sample in samples {
        wav.extend_from_slice(&sample.to_le_bytes());
    }
    wav
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pcm_wav(sample_rate: u32, channels: u16, frames: &[[i16; 2]]) -> Vec<u8> {
        let block_align = channels * 2;
        let data_len = frames.len() as u32 * u32::from(block_align);
        let mut wav = Vec::with_capacity(44 + data_len as usize);
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16_u32.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&channels.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * u32::from(block_align)).to_le_bytes());
        wav.extend_from_slice(&block_align.to_le_bytes());
        wav.extend_from_slice(&16_u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_len.to_le_bytes());
        for frame in frames {
            wav.extend_from_slice(&frame[0].to_le_bytes());
            if channels == 2 {
                wav.extend_from_slice(&frame[1].to_le_bytes());
            }
        }
        wav
    }

    fn decoded_frames(bytes: &[u8]) -> Vec<[i16; 2]> {
        let layout = pcm_layout(bytes, "TEST").unwrap();
        bytes[layout.data_start..layout.data_end]
            .chunks_exact(layout.block_align)
            .map(|frame| {
                let left = i16::from_le_bytes([frame[0], frame[1]]);
                let right = if layout.channels == 2 {
                    i16::from_le_bytes([frame[2], frame[3]])
                } else {
                    left
                };
                [left, right]
            })
            .collect()
    }

    #[test]
    fn accepts_pcm16_and_rejects_truncation_or_float() {
        let valid = fixture_pcm_wav();
        assert!((validate_pcm16_wav(&valid, "TEST").unwrap() - 0.1).abs() < 0.000_001);
        assert!(validate_pcm16_wav(&valid[..valid.len() - 1], "TEST").is_err());
        let mut float = valid;
        float[20..22].copy_from_slice(&3_u16.to_le_bytes());
        assert!(validate_pcm16_wav(&float, "TEST").is_err());

        let mut streaming = fixture_pcm_wav();
        streaming[4..8].copy_from_slice(&u32::MAX.to_le_bytes());
        streaming[40..44].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(validate_pcm16_wav(&streaming, "TEST").is_err());
        normalize_streaming_pcm16_wav(&mut streaming, "TEST").unwrap();
        assert!((validate_pcm16_wav(&streaming, "TEST").unwrap() - 0.1).abs() < 0.000_001);
    }

    #[test]
    fn equalizer_renders_one_350ms_boundary_without_clipping_activity() {
        const RATE: usize = 16_000;
        let mut frames = vec![[0_i16, 0_i16]; RATE / 2];
        let signal = vec![[8_000_i16, 8_000_i16]; RATE / 10];
        frames.extend_from_slice(&signal);
        frames.extend(vec![[0_i16, 0_i16]; RATE * 3 / 5]);
        let wav = pcm_wav(RATE as u32, 1, &frames);

        let (normalized, stats) = equalize_pcm16_wav_boundary(&wav, 350, "TEST").unwrap();
        assert!(stats.activity_found);
        assert!((stats.leading_ms - 50.0).abs() < 0.001);
        assert!((stats.trailing_ms - 300.0).abs() < 0.001);

        let output = decoded_frames(&normalized);
        let first = output.iter().position(|frame| frame[0] != 0).unwrap();
        let last = output.iter().rposition(|frame| frame[0] != 0).unwrap();
        assert_eq!(first, RATE * 50 / 1_000);
        assert_eq!(output.len() - last - 1, RATE * 300 / 1_000);
        assert_eq!(&output[first..=last], signal.as_slice());
        let combined_boundary_ms = (output.len() - last - 1 + first) as f64 * 1_000.0 / RATE as f64;
        assert!((combined_boundary_ms - 350.0).abs() < 0.001);
    }

    #[test]
    fn equalizer_renders_an_800ms_section_boundary() {
        const RATE: usize = 16_000;
        let mut frames = vec![[0_i16, 0_i16]; RATE / 2];
        frames.extend(vec![[8_000_i16, 8_000_i16]; RATE / 10]);
        frames.extend(vec![[0_i16, 0_i16]; RATE]);
        let wav = pcm_wav(RATE as u32, 1, &frames);

        let (normalized, stats) = equalize_pcm16_wav_boundary(&wav, 800, "TEST").unwrap();
        let output = decoded_frames(&normalized);
        let first = output.iter().position(|frame| frame[0] != 0).unwrap();
        let last = output.iter().rposition(|frame| frame[0] != 0).unwrap();
        assert!((stats.leading_ms - 50.0).abs() < 0.001);
        assert!((stats.trailing_ms - 750.0).abs() < 0.001);
        let combined_boundary_ms = (output.len() - last - 1 + first) as f64 * 1_000.0 / RATE as f64;
        assert!((combined_boundary_ms - 800.0).abs() < 0.001);
    }

    #[test]
    fn equalizer_preserves_stereo_frame_alignment_and_short_onset() {
        const RATE: usize = 48_000;
        let mut frames = vec![[8_i16, -8_i16]; RATE / 5];
        frames.extend(vec![[0_i16, 12_000_i16]; RATE / 200]);
        frames.extend(vec![[8_i16, -8_i16]; RATE / 5]);
        let wav = pcm_wav(RATE as u32, 2, &frames);

        let (normalized, stats) = equalize_pcm16_wav_boundary(&wav, 350, "TEST").unwrap();
        assert!(stats.activity_found);
        let output = decoded_frames(&normalized);
        assert!(output.iter().any(|frame| frame == &[0, 12_000]));
        assert_eq!((normalized.len() - 44) % 4, 0);
    }

    #[test]
    fn equalizer_fails_closed_for_silence_malformed_or_unsafe_target() {
        let silence = fixture_pcm_wav();
        let (unchanged, stats) = equalize_pcm16_wav_boundary(&silence, 350, "TEST").unwrap();
        assert_eq!(unchanged, silence);
        assert!(!stats.activity_found);
        assert!(equalize_pcm16_wav_boundary(&silence[..40], 350, "TEST").is_err());
        assert!(equalize_pcm16_wav_boundary(&silence, 149, "TEST").is_err());
    }
}
