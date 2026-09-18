READY 258-voice-controls from p19 (ex-cache-glm), 15/09/2026 16:55 BRT. SUPERSEDES the 16:4x draft (never submitted); final r1 after p16 readback corrections.

Root (only write root): /home/notroot/Documents/Code/personal/tauri-pdf-reader-258-voice-controls @ 35801daa, branch 258-voice-controls.

Frozen files (byte-stable, authored only — NOT run locally):
- src/components/playback-bar/AiVoiceSelector.tsx  d8d80468c7ac4a1ff8fc4cdc427d2859c6c0290554f5b8d30c9719348f4e34d3
- src/components/playback-bar/AiVoiceSelector.css  df90dba042dc65ae7129f1536fdde9ad6f8c83c3995f54be9799382b95e69fd4
- src/components/playback-bar/AiVoiceSelector.test.tsx  cf2dbbb4439238e28a6ce9d5e457dcf0e61f810671946a09a04606924126b9d9  (10 checks)

Runnable check for the serialized slot:
pnpm test:run -- src/components/playback-bar/AiVoiceSelector.test.tsx

Scope honored: only AiVoiceSelector.tsx/.css + this test + specs/258-voice-controls/ + reports/; no AiPlaybackBar/AiTtsSettings/Cockpit/hook/store edits; no provider calls; synthetic fixtures only.

p16 corrections all incorporated pre-freeze, including the 16:50 readback: actual-state precedence in source (connecting visible while uninitialized; error > empty; visible error text beside populated selector backing aria-invalid), resolve-void store-truth contract (no Promise-success claim), unique dual-mount ids (useId) + scoped locators (p14 coordination), strict value binding/placeholder, fixture-leak fixes (explicit all-connected in empty/error cases).

Single canonical reports: reports/DELIVERY.md + reports/freeze-258.md (hash source of truth).

Caps: 258 post-freeze repairs 0/2 (only on failing receipt). 254 frozen files untouched (byte-identical for 252 review). Flash-authored → needs exact-head Codex Sol review; no self-acceptance.
