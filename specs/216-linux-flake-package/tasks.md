# Tasks 216

1. [x] specs trio (branch-bound path specs/216-linux-flake-package/).
2. [x] `nix/lectrice-linux.nix` — upstream hook recipe (default deb install, wrapGAppsHook3, alsa/openssl/WebKitGTK/GStreamer -sys deps, gst_all_1).
3. [x] flake.nix linuxOutputs: packages lectrice/default, apps.default, checks.package-contract (same-verifier malformed-fixture negative control).
4. [x] `--dry-run` preflights (closure 243.0 MiB download / 1.3 GiB unpacked, 760 paths — under the 15 GiB gate).
5. [x] Real build — UNBLOCKED 17/09/2026: `nix build .#lectrice --cores 0` green on the rebased branch, output `mqr6z31…-lectrice-0.2.0` (binary runs; frozen 25-min cap was the only blocker). One real bug found and fixed by execution: the contract verifier path pointed at repo root instead of `nix/`.
6. [x] Contract check — unblocked with 5: verifier path fixed; check build re-run against the real package (same-verifier negative control intact).
7. [x] docs/linux-nix.md + backlog entry.
8. [x] Run-dir report (hashes, exits, BLOCKED diagnosis, remaining gates).

[B] = blocked with evidence in the run report; caps NOT reset; no rerun by this seat.
