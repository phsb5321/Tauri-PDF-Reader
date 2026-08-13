#!/usr/bin/env bash
#
# e2e-profile.sh — the ONE shared hermetic-profile entry point for every e2e
# lane. Source this (after `cd` to the repo root) and the app under test gets
# a fresh temp profile for BOTH its config dir and its data dir:
#
#   - XDG_CONFIG_HOME: tauri-plugin-sql resolves its relative DB path
#     (`sqlite:pdf-reader.db`) against app_config_dir — on Linux
#     $XDG_CONFIG_HOME/com.lectrice.reader. Without this, a lane silently
#     opens AND writes Pedro's real library (WAL transactions every run;
#     confirmed 08/08/2026). This is the #95 lesson — do not re-learn it.
#   - XDG_DATA_HOME: fs scope ($APPLOCALDATA), WebKit storage, hw-accel flags.
#
# Fail-closed pairing: the e2e-tts-fixture Rust build refuses to boot unless
# app_config_dir is under the temp root (src-tauri/src/lib.rs
# assert_hermetic_profile). A lane that forgets to source this file, or a
# lane added in the future, FAILS instead of leaking user data.
#
# Usage:
#   source ./scripts/e2e-profile.sh
#   E2E_PROFILE_DIR is exported; XDG_DATA_HOME/XDG_CONFIG_HOME point at it.
#   The app dir (fixtures go here) is "$E2E_PROFILE_DIR/com.lectrice.reader".
set -euo pipefail

if [ -z "${E2E_PROFILE_DIR:-}" ]; then
  E2E_PROFILE_DIR="$(mktemp -d)"
fi
export E2E_PROFILE_DIR
export XDG_DATA_HOME="$E2E_PROFILE_DIR"
export XDG_CONFIG_HOME="$E2E_PROFILE_DIR"
# The app cache dir (app_cache_dir() — audio cache, cover rasters) defaults to
# ~/.cache/<id> and would leak into the real user cache; keep it hermetic too.
export XDG_CACHE_HOME="$E2E_PROFILE_DIR/cache"
