# `v0.2.0` release record — 16/08/2026

What was published, from which commit, and what was checked first. Written
after the tag, because a commit cannot cite runs against itself
(`release-decision-checklist-2026-08-13.md`, "Decision rule").

## The release

```
tag        v0.2.0                (annotated)
commit     545c377cac3920650f7ff06ec575676e7562ad65
prerelease false
workflow   31946408443  (release.yml, self-hosted vm103)  success
assets     Lectrice_0.2.0_amd64.AppImage   83286520 B
           Lectrice_0.2.0_amd64.deb         9231894 B
```

Published asset digests:

```
8cc2f7cbabe5cb48685c1ead830f5d7e36547fed784616a7a572bf23f6e03e29  Lectrice_0.2.0_amd64.AppImage
73ef9f620419428aef98a838f5c85b4595ea5ff839084c1f0915505213cc76f4  Lectrice_0.2.0_amd64.deb
```

They differ from the RC's digests (`rc-evidence-2026-08-15.md`) because the
tree moved on between `3d68d0e` and `545c377`; the deb also differs in size by
16 bytes.

## Checked before the tag, at exactly `545c377`

| Check | Receipt | Result |
| --- | --- | --- |
| Private five-book corpus | `/tmp/lectrice-corpus-FINAL-545c377.log` | `source.json` matches and clean, 15/15 phases, 5 distinct cover ties, corrupt + EPUB controls exit 0, `failures.tsv` 0 bytes, temp profile and `dist/` absent, tree clean |
| CI | run `31944798514` | success |
| Sonar | run `31944798503` | success; authenticated gate `OK`, no failing conditions |
| CodeQL | run `31944798507` | success; 0 open alerts repo-wide |
| Different-family audit | Codex, exact SHA | `CUTTABLE`, no blockers |
| Open PRs | — | 0 |

## Checked after publication, on the published bytes

Both assets were downloaded from the release and run in a clean
`ubuntu:24.04` container under Xvfb. Two things make the transcript checkable:
the artifact is hashed **inside the container it is tested in**, so the run is
bound to the published bytes rather than to a filename, and the window is
attributed by ownership rather than by name, because the container already has
one unrelated window (`windows_before=1`).

deb — full log `/tmp/lectrice-v0.2.0-deb-verify.log`:

```
73ef9f620419428aef98a838f5c85b4595ea5ff839084c1f0915505213cc76f4  /tmp/lectrice.deb
Version: 0.2.0
windows_before=1
OWNED_WINDOW=2097155 pid=5868 app_pid=5868
WM_CLASS(STRING) = "tauri-pdf-reader", "Tauri-pdf-reader"
  Geometry: 1200x800
DEB_STRICT_PASS
```

AppImage — full log `/tmp/lectrice-v0.2.0-appimage-verify.log`. Extract-and-run
execs the real binary as a child, so ownership is the window PID's parent chain
back to the launcher, not PID equality:

```
8cc2f7cbabe5cb48685c1ead830f5d7e36547fed784616a7a572bf23f6e03e29  /tmp/lectrice.AppImage
LAUNCHER_PID=5856
OWNED_WINDOW=2097155 window_pid=5870 launcher_pid=5856
    PID    PPID COMMAND
   5870    5856 tauri-pdf-reade
    PID    PPID COMMAND
   5856    5848 lectrice.AppIma
WM_CLASS(STRING) = "tauri-pdf-reader", "Tauri-pdf-reader"
  Geometry: 1200x800
APPIMAGE_OWNERSHIP_PASS
```

Both in-container digests match the published assets listed above. PIDs repeat
across runs of these containers because the startup sequence is deterministic;
that is why the digest, not the PID, is what binds a transcript to an artifact.

## What this release does not claim

- **Linux only.** macOS and Windows artifacts are not built or published. The
  macOS build/launch measurement, and the three reasons its journey cannot be
  driven, are in `rc-evidence-2026-08-15.md` and `docs/KNOWN_LIMITATIONS.md`.
- **Fixture TTS in tests.** The packaged lanes drive a deterministic fixture
  engine; the live ElevenLabs path is not exercised in CI.
- Everything else still open is in `docs/KNOWN_LIMITATIONS.md`; the per-journey
  oracle map is in `docs/JOURNEY_EVIDENCE.md`.

## Reversal

`gh release delete v0.2.0` and `git push --delete origin v0.2.0` remove the
published release and the remote tag. The commit stays on `main`, and so do
the local tag (`git tag -d v0.2.0`) and the Actions run history, which cannot
be unpublished. Anyone who already downloaded an asset keeps it.
