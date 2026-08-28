const ELEVEN_ADAPTER: &str = include_str!("../src/ai_tts/elevenlabs.rs");
const TTS_ENGINE: &str = include_str!("../src/ai_tts/mod.rs");

#[test]
fn current_eleven_model() {
    let runtime = format!("{ELEVEN_ADAPTER}\n{TTS_ENGINE}");
    assert!(
        !runtime.contains("eleven_monolingual_v1"),
        "the removed ElevenLabs v1 model must not remain in runtime source"
    );
    assert!(
        ELEVEN_ADAPTER
            .contains("pub const ELEVEN_DEFAULT_MODEL_ID: &str = \"eleven_multilingual_v2\";"),
        "the current reading default must be explicit and reviewable"
    );
    assert!(
        ELEVEN_ADAPTER.contains("model_id.unwrap_or(ELEVEN_DEFAULT_MODEL_ID)"),
        "every outbound request path must use the shared current default"
    );
    assert!(
        TTS_ENGINE.contains("ELEVEN_PROSODY_COMPILER_REVISION"),
        "cache identity must change with the model-specific prosody compiler"
    );
}
