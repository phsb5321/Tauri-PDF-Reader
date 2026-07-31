# Checklist — Spec 053

- [ ] Worktree/branch isolation proven.
- [ ] No workflow, release, capability, filesystem-scope, or credential delta.
- [ ] Make targets are discoverable, sequential, and bounded.
- [ ] Evidence wrapper preserves the real command exit status.
- [ ] Report refuses missing or red evidence.
- [ ] Native smoke opens the fixture through real PDF/library paths.
- [ ] Native smoke uses visible controls and real Tauri commands/events.
- [ ] Backend marks are monotonic and text/UTF-16 aligned.
- [ ] Pause/resume/stop and page seek are exercised.
- [ ] Restart restores persisted page state.
- [ ] Error is backend-injected, accessible, dismissible, and cleaned up.
- [ ] Temporary XDG/driver processes are cleaned on all exits.
- [ ] Verdict negative control proves `BLOCK` red and `PASS` green.
- [ ] Production-wire negative control proves smoke red then green.
- [ ] Fresh Qwen review is `PASS` and bound to the candidate SHA.
- [ ] Evidence report contains commands, artifacts, deferrals, and revert path.
- [ ] Required CI/review is green and PR is squash-merged.
