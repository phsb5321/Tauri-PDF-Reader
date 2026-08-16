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
`ubuntu:24.04` container under Xvfb, with the window attributed by ownership
rather than by name (the container already has one unrelated window):

```
deb       Version: 0.2.0
          OWNED_WINDOW=2097155 pid=5867 app_pid=5867
          WM_CLASS(STRING) = "tauri-pdf-reader", "Tauri-pdf-reader"
          Geometry: 1200x800                       DEB_STRICT_PASS

AppImage  LAUNCHER_PID=5855  window_pid=5869
          5869 -> 5855 -> 5847   (ps ancestry back to the launcher)
          WM_CLASS(STRING) = "tauri-pdf-reader", "Tauri-pdf-reader"
          Geometry: 1200x800                       APPIMAGE_OWNERSHIP_PASS
```

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
published release and tag; the commit stays on `main` and nothing else changes.
