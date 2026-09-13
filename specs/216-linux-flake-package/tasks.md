# Tasks 216

1. [x] specs trio (branch-bound path specs/216-linux-flake-package/).
2. [x] `nix/lectrice-linux.nix` — upstream hook recipe (default deb install, wrapGAppsHook3, alsa/openssl/WebKitGTK/GStreamer -sys deps, gst_all_1).
3. [x] flake.nix linuxOutputs: packages lectrice/default, apps.default, checks.package-contract (same-verifier malformed-fixture negative control).
4. [x] `--dry-run` preflights (closure 243.0 MiB download / 1.3 GiB unpacked, 760 paths — under the 15 GiB gate).
5. [B] Real build: **BLOCKED by original 25-min serial cap** — attempt-1 owned-SIGINT at 76 s (fetch), attempt-2 timeout rc=124 at 1440 s mid final app crate `lectrice-0.2.0` (deps complete; flushed 820-line compiler log). Timeout ≠ source bug; no output path exists.
6. [ ] Contract check — blocked by 5.
7. [x] docs/linux-nix.md + backlog entry.
8. [x] Run-dir report (hashes, exits, BLOCKED diagnosis, remaining gates).

[B] = blocked with evidence in the run report; caps NOT reset; no rerun by this seat.
