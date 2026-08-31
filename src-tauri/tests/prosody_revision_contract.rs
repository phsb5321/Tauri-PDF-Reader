const FRONTEND_PLAN: &str = include_str!("../../src/lib/prosody-plan.ts");
const TTS_ENGINE: &str = include_str!("../src/ai_tts/mod.rs");

#[test]
fn prosody_revision_contract() {
    const REVISION: &str = "source-aligned-v4";
    assert!(
        FRONTEND_PLAN.contains(&format!("PROSODY_PLAN_REVISION = \"{REVISION}\"")),
        "frontend source/spoken planner revision drifted"
    );
    assert!(
        TTS_ENGINE.contains(&format!("SOURCE_PROSODY_REVISION: &str = \"{REVISION}\"")),
        "backend cache revision must move with the frontend planner"
    );
    for provider_coordinate in [
        "ELEVEN_PROSODY_COMPILER_REVISION}_{SOURCE_PROSODY_REVISION}",
        "PCM_PROSODY_REVISION,\n                    SOURCE_PROSODY_REVISION",
        "PCM_PROSODY_REVISION}_{SOURCE_PROSODY_REVISION}",
    ] {
        assert!(
            TTS_ENGINE.contains(provider_coordinate),
            "provider cache coordinate omitted the source planner revision: {provider_coordinate}"
        );
    }
}
