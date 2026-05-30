Execute the Lectrice forward loop by reading and following:

`.claude/skills/lectrice-forward-loop/SKILL.md`

Default priority:

1. Dirty worktree triage.
2. Housekeeping metadata.
3. Tauri security scope tightening.
4. Coverage gate decision.
5. Bundle/profile smoke.
6. Word-level highlight + streaming TTS.
7. pdf.js 5.x + render cancellation.
8. Kokoro offline voice.
9. Accessibility quick wins.

Do not push main.
Do not publish releases.
Do not widen Tauri scopes.
Do not leak API keys.
Do not add telemetry.
Run Codex adversarial review for every logical change set.
Update docs/agent-backlog-state.md each iteration.
