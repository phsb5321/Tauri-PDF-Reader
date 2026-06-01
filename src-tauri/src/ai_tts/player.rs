//! Audio playback using rodio, driven on a dedicated audio thread.
//!
//! rodio's `Sink`/`OutputStream` are `!Send`/`!Sync`. The previous design shared
//! them behind an `Arc<Mutex<_>>` with hand-written `unsafe impl Send/Sync` — and
//! also exposed `play_mp3_blocking`, which held the state lock across
//! `sink.sleep_until_end()`, wedging `pause`/`stop` for the whole clip (a
//! deadlock). Both problems are gone here: a single dedicated thread OWNS the
//! sink (it never crosses a thread boundary, so no `unsafe` is needed) and is
//! driven by a command channel. Public methods only SEND commands, so they never
//! block on playback. The thread polls `Sink::empty()` between commands and fires
//! `on_finished` when playback ends naturally — the audio-finished signal the app
//! previously lacked.

use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

/// How often the audio thread wakes (when idle) to poll for natural completion.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// The operations the player needs from an audio sink. Abstracted so the control
/// logic — prompt `pause`/`stop` (no deadlock) and finished-detection — is
/// testable with a mock backend that needs no audio device (rodio's
/// `OutputStream::try_default()` fails on a headless CI machine).
///
/// Not `Send`: the concrete sink is built INSIDE the audio thread (by the factory
/// passed to `with_backend`) and owned there for its whole life, so the rodio
/// `Sink`/`OutputStream` (`!Send`) never cross a thread boundary. Only the
/// factory closure and the finished-callback are sent to the thread.
pub trait AudioSink {
    /// Replace the current source with freshly-decoded MP3 bytes and play.
    fn play_mp3(&mut self, data: &[u8]) -> Result<(), String>;
    fn pause(&mut self);
    fn resume(&mut self);
    fn stop(&mut self);
    fn set_volume(&mut self, volume: f32);
    fn set_speed(&mut self, speed: f32);
    /// True when nothing is queued/playing (natural end, or after `stop`).
    fn is_empty(&self) -> bool;
}

/// Commands sent to the audio thread.
enum Command {
    Play(Vec<u8>),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    SetSpeed(f32),
    /// Liveness probe: the thread replies immediately. A wedged thread (the old
    /// deadlock) would never reply, so a bounded wait on the reply proves the
    /// transport is responsive even during playback.
    Ping(Sender<()>),
    Shutdown,
}

/// Playback flags the audio thread keeps current; read by the public getters.
#[derive(Default)]
struct Flags {
    playing: bool,
    paused: bool,
    last_error: Option<String>,
}

/// Audio player — a `Send + Sync` handle to a dedicated audio thread.
pub struct AudioPlayer {
    tx: Sender<Command>,
    flags: Arc<Mutex<Flags>>,
    handle: Option<JoinHandle<()>>,
}

impl AudioPlayer {
    /// Production player backed by the system audio device via rodio.
    pub fn new() -> Self {
        Self::with_backend(
            || RodioSink::new().map(|s| Box::new(s) as Box<dyn AudioSink>),
            None,
        )
    }

    /// Production player that invokes `on_finished` when playback ends naturally
    /// (the sink drains without an explicit stop). Wire this to emit an
    /// `ai-tts:finished` event so the frontend can complete on the real signal
    /// instead of a timer estimate.
    #[allow(dead_code)] // wiring to the Tauri AppHandle is a follow-up
    pub fn with_finished_callback(on_finished: Box<dyn Fn() + Send>) -> Self {
        Self::with_backend(
            || RodioSink::new().map(|s| Box::new(s) as Box<dyn AudioSink>),
            Some(on_finished),
        )
    }

    /// Spawn the audio thread with a caller-provided sink factory. The factory
    /// runs INSIDE the thread, so the (`!Send`) sink is owned by exactly one
    /// thread and never crosses a thread boundary — no `unsafe` needed.
    fn with_backend<F>(make_sink: F, on_finished: Option<Box<dyn Fn() + Send>>) -> Self
    where
        F: FnOnce() -> Result<Box<dyn AudioSink>, String> + Send + 'static,
    {
        let (tx, rx) = channel::<Command>();
        let flags = Arc::new(Mutex::new(Flags::default()));
        let thread_flags = Arc::clone(&flags);
        let handle = std::thread::Builder::new()
            .name("lectrice-audio".into())
            .spawn(move || match make_sink() {
                Ok(sink) => audio_thread(rx, sink, thread_flags, on_finished),
                Err(e) => {
                    tracing::error!("Audio backend init failed: {e}");
                    if let Ok(mut f) = thread_flags.lock() {
                        f.last_error = Some(e);
                    }
                }
            })
            .expect("spawn audio thread");
        Self {
            tx,
            flags,
            handle: Some(handle),
        }
    }

    fn send(&self, cmd: Command) -> Result<(), String> {
        self.tx
            .send(cmd)
            .map_err(|_| "AUDIO_THREAD_UNAVAILABLE".to_string())
    }

    /// Round-trip a `Ping` and wait up to `timeout` for the reply. `Ok(())` proves
    /// the audio thread is processing commands (not wedged).
    pub fn ping(&self, timeout: Duration) -> Result<(), String> {
        let (reply_tx, reply_rx) = channel();
        self.send(Command::Ping(reply_tx))?;
        reply_rx
            .recv_timeout(timeout)
            .map_err(|_| "AUDIO_THREAD_UNRESPONSIVE".to_string())
    }

    /// Queue MP3 bytes for playback. Non-blocking with respect to playback: it
    /// returns once the audio thread has ACCEPTED the clip (a bounded liveness
    /// round-trip), NOT when the audio finishes. A decode error surfaces here.
    pub fn play_mp3(&self, data: &[u8]) -> Result<(), String> {
        if let Ok(mut f) = self.flags.lock() {
            f.last_error = None;
        }
        self.send(Command::Play(data.to_vec()))?;
        // Commands are processed in order, so a Ping reply means Play ran.
        self.ping(Duration::from_secs(5))?;
        if let Ok(f) = self.flags.lock() {
            if let Some(e) = &f.last_error {
                return Err(e.clone());
            }
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.send(Command::Stop)
    }
    pub fn pause(&self) -> Result<(), String> {
        self.send(Command::Pause)
    }
    pub fn resume(&self) -> Result<(), String> {
        self.send(Command::Resume)
    }
    #[allow(dead_code)]
    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.send(Command::SetVolume(volume))
    }
    #[allow(dead_code)]
    pub fn set_speed(&self, speed: f32) -> Result<(), String> {
        self.send(Command::SetSpeed(speed))
    }

    #[allow(dead_code)] // public status API; used by tests and future wiring
    pub fn is_playing(&self) -> bool {
        self.flags
            .lock()
            .map(|f| f.playing && !f.paused)
            .unwrap_or(false)
    }
    #[allow(dead_code)] // public status API; used by tests and future wiring
    pub fn is_paused(&self) -> bool {
        self.flags.lock().map(|f| f.paused).unwrap_or(false)
    }
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        let _ = self.tx.send(Command::Shutdown);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

/// The audio thread main loop. Owns `sink`; never blocks on playback.
fn audio_thread(
    rx: Receiver<Command>,
    mut sink: Box<dyn AudioSink>,
    flags: Arc<Mutex<Flags>>,
    on_finished: Option<Box<dyn Fn() + Send>>,
) {
    // `watching` is true after a successful Play, until the clip finishes or is
    // stopped — it gates finished-detection so a drained idle sink doesn't fire
    // the callback repeatedly.
    let mut watching = false;
    loop {
        match rx.recv_timeout(POLL_INTERVAL) {
            Ok(Command::Play(data)) => {
                let result = sink.play_mp3(&data);
                if let Ok(mut f) = flags.lock() {
                    match result {
                        Ok(()) => {
                            f.playing = true;
                            f.paused = false;
                            watching = true;
                        }
                        Err(e) => {
                            f.playing = false;
                            f.paused = false;
                            f.last_error = Some(e);
                            watching = false;
                        }
                    }
                }
            }
            Ok(Command::Pause) => {
                sink.pause();
                if let Ok(mut f) = flags.lock() {
                    f.paused = true;
                }
            }
            Ok(Command::Resume) => {
                sink.resume();
                if let Ok(mut f) = flags.lock() {
                    f.paused = false;
                }
            }
            Ok(Command::Stop) => {
                sink.stop();
                watching = false;
                if let Ok(mut f) = flags.lock() {
                    f.playing = false;
                    f.paused = false;
                }
            }
            Ok(Command::SetVolume(v)) => sink.set_volume(v),
            Ok(Command::SetSpeed(s)) => sink.set_speed(s),
            Ok(Command::Ping(reply)) => {
                let _ = reply.send(());
            }
            Ok(Command::Shutdown) | Err(RecvTimeoutError::Disconnected) => {
                sink.stop();
                break;
            }
            Err(RecvTimeoutError::Timeout) => {}
        }

        // Finished-detection: a watched sink that has gone empty has finished
        // naturally. `is_empty()` is authoritative — a sink paused mid-clip still
        // has samples queued, so it is NOT empty; only a fully-drained sink reads
        // empty. (An earlier `!paused` guard here could wedge the clip forever if
        // you paused exactly as it drained: paused stayed true, watching stayed
        // true, and completion never fired.)
        if watching && sink.is_empty() {
            watching = false;
            if let Ok(mut f) = flags.lock() {
                f.playing = false;
            }
            if let Some(cb) = &on_finished {
                cb();
            }
        }
    }
}

/// Real rodio-backed sink. Constructed on (and owned by) the audio thread, so it
/// never has to be `Send`. (`player` only compiles under `elevenlabs-tts`, which
/// brings in rodio, so this is always available where it is referenced.)
struct RodioSink {
    _stream: rodio::OutputStream,
    handle: rodio::OutputStreamHandle,
    sink: Option<rodio::Sink>,
}

impl RodioSink {
    fn new() -> Result<Self, String> {
        let (stream, handle) =
            rodio::OutputStream::try_default().map_err(|e| format!("AUDIO_INIT_ERROR: {e}"))?;
        Ok(Self {
            _stream: stream,
            handle,
            sink: None,
        })
    }
}

impl AudioSink for RodioSink {
    fn play_mp3(&mut self, data: &[u8]) -> Result<(), String> {
        if let Some(old) = self.sink.take() {
            old.stop();
        }
        let cursor = std::io::Cursor::new(data.to_vec());
        let source = rodio::Decoder::new(cursor).map_err(|e| format!("DECODE_ERROR: {e}"))?;
        let sink = rodio::Sink::try_new(&self.handle).map_err(|e| format!("SINK_ERROR: {e}"))?;
        sink.append(source);
        self.sink = Some(sink);
        Ok(())
    }
    fn pause(&mut self) {
        if let Some(s) = &self.sink {
            s.pause();
        }
    }
    fn resume(&mut self) {
        if let Some(s) = &self.sink {
            s.play();
        }
    }
    fn stop(&mut self) {
        if let Some(s) = self.sink.take() {
            s.stop();
        }
    }
    fn set_volume(&mut self, volume: f32) {
        if let Some(s) = &self.sink {
            s.set_volume(volume.clamp(0.0, 1.0));
        }
    }
    fn set_speed(&mut self, speed: f32) {
        if let Some(s) = &self.sink {
            s.set_speed(speed.clamp(0.5, 2.0));
        }
    }
    fn is_empty(&self) -> bool {
        self.sink.as_ref().map(|s| s.empty()).unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::time::Instant;

    /// Mock sink with no audio device. Reports `is_empty()` true after
    /// `empty_after` polls of a playing clip, so finished-detection can be driven
    /// deterministically; records pause so prompt-pause can be asserted.
    struct MockSink {
        polls: AtomicUsize,
        empty_after: usize,
        playing: AtomicBool,
        paused: AtomicBool,
    }
    impl MockSink {
        fn new(empty_after: usize) -> Arc<Self> {
            Arc::new(Self {
                polls: AtomicUsize::new(0),
                empty_after,
                playing: AtomicBool::new(false),
                paused: AtomicBool::new(false),
            })
        }
    }
    impl AudioSink for Arc<MockSink> {
        fn play_mp3(&mut self, _data: &[u8]) -> Result<(), String> {
            self.polls.store(0, Ordering::SeqCst);
            self.paused.store(false, Ordering::SeqCst);
            self.playing.store(true, Ordering::SeqCst);
            Ok(())
        }
        fn pause(&mut self) {
            self.paused.store(true, Ordering::SeqCst);
        }
        fn resume(&mut self) {
            self.paused.store(false, Ordering::SeqCst);
        }
        fn stop(&mut self) {
            self.playing.store(false, Ordering::SeqCst);
        }
        fn set_volume(&mut self, _v: f32) {}
        fn set_speed(&mut self, _s: f32) {}
        fn is_empty(&self) -> bool {
            if !self.playing.load(Ordering::SeqCst) {
                return true;
            }
            // Each poll advances; report empty once we've been polled enough.
            self.polls.fetch_add(1, Ordering::SeqCst) >= self.empty_after
        }
    }

    /// The old deadlock: pause could not be serviced while a clip played. Prove
    /// that with a clip "playing forever", pause + a liveness Ping both complete
    /// well within a timeout — i.e. the audio thread is never wedged.
    #[test]
    fn pause_is_prompt_during_playback() {
        let mock = MockSink::new(usize::MAX); // never drains → plays "forever"
        let backend = Arc::clone(&mock);
        let player =
            AudioPlayer::with_backend(move || Ok(Box::new(backend) as Box<dyn AudioSink>), None);

        player.play_mp3(b"fixture").expect("play accepted");

        let start = Instant::now();
        player.pause().expect("pause sent");
        player
            .ping(Duration::from_secs(2))
            .expect("thread responsive after pause");
        let elapsed = start.elapsed();

        assert!(
            elapsed < Duration::from_secs(1),
            "pause/ping blocked for {elapsed:?} — audio thread wedged"
        );
        assert!(
            mock.paused.load(Ordering::SeqCst),
            "pause did not reach sink"
        );
        assert!(player.is_paused());
    }

    /// Finished-detection: when the sink drains naturally, `on_finished` fires
    /// exactly once and playing flips false — without any explicit stop.
    #[test]
    fn finished_callback_fires_when_sink_drains() {
        let fired = Arc::new(AtomicUsize::new(0));
        let fired_cb = Arc::clone(&fired);
        let mock = MockSink::new(2); // empty after ~2 polls (~100ms at 50ms poll)
        let backend = Arc::clone(&mock);
        let player = AudioPlayer::with_backend(
            move || Ok(Box::new(backend) as Box<dyn AudioSink>),
            Some(Box::new(move || {
                fired_cb.fetch_add(1, Ordering::SeqCst);
            })),
        );

        player.play_mp3(b"fixture").expect("play accepted");

        let start = Instant::now();
        while fired.load(Ordering::SeqCst) == 0 && start.elapsed() < Duration::from_secs(2) {
            std::thread::sleep(Duration::from_millis(20));
        }
        assert_eq!(
            fired.load(Ordering::SeqCst),
            1,
            "on_finished should fire exactly once when the sink drains"
        );
        assert!(!player.is_playing());
    }

    /// Pausing exactly as a clip drains must still complete — regression guard
    /// for the wedge where a `!paused` gate on finished-detection left a
    /// paused-at-end clip `playing` forever.
    #[test]
    fn pause_at_end_still_completes() {
        let fired = Arc::new(AtomicUsize::new(0));
        let fired_cb = Arc::clone(&fired);
        let mock = MockSink::new(1); // drains almost immediately
        let backend = Arc::clone(&mock);
        let player = AudioPlayer::with_backend(
            move || Ok(Box::new(backend) as Box<dyn AudioSink>),
            Some(Box::new(move || {
                fired_cb.fetch_add(1, Ordering::SeqCst);
            })),
        );

        player.play_mp3(b"fixture").expect("play accepted");
        let _ = player.pause(); // pause right as it drains

        let start = Instant::now();
        while fired.load(Ordering::SeqCst) == 0 && start.elapsed() < Duration::from_secs(2) {
            std::thread::sleep(Duration::from_millis(20));
        }
        assert_eq!(
            fired.load(Ordering::SeqCst),
            1,
            "a clip that drains while paused must still complete"
        );
    }

    /// Stopping before the sink drains must NOT fire the finished callback.
    #[test]
    fn stop_does_not_fire_finished() {
        let fired = Arc::new(AtomicBool::new(false));
        let fired_cb = Arc::clone(&fired);
        let mock = MockSink::new(usize::MAX); // never drains on its own
        let backend = Arc::clone(&mock);
        let player = AudioPlayer::with_backend(
            move || Ok(Box::new(backend) as Box<dyn AudioSink>),
            Some(Box::new(move || fired_cb.store(true, Ordering::SeqCst))),
        );

        player.play_mp3(b"fixture").expect("play accepted");
        player.stop().expect("stop sent");
        player.ping(Duration::from_secs(2)).expect("responsive");
        std::thread::sleep(Duration::from_millis(200));

        assert!(
            !fired.load(Ordering::SeqCst),
            "finished must not fire on an explicit stop"
        );
        assert!(!player.is_playing());
    }
}
