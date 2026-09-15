#!/usr/bin/env bash
#
# Reproducible home/library audit capture — evidence for the 16/08/2026 home
# audit report. One seed per invocation:
#   AUDIT_SEED=empty  bash scripts/home-audit-capture.sh   (0 books — no seeding)
#   AUDIT_SEED=single bash scripts/home-audit-capture.sh   (1 book)
#   AUDIT_SEED=dual   bash scripts/home-audit-capture.sh   (2 books)
#   AUDIT_SEED=cover  bash scripts/home-audit-capture.sh   (2 covers + 1 fallback)
#
# Hermetic profile pinned under /tmp (assert_hermetic_profile refuses to boot
# outside /tmp; this host's default TMPDIR is /var/tmp).
#
# Honors the shared flock — REQUIRED, and the script does NOT take it for you
# (same contract as e2e/run-corpus-journey.sh; no script in this repo self-locks,
# because the documented callers already wrap it and an inner flock on the same
# file would deadlock against its own wrapper):
#
#   flock /tmp/lectrice-heavy-gate.lock bash scripts/home-audit-capture.sh
#
# Run two seeds concurrently WITHOUT the lock and they corrupt each other
# silently rather than failing: both `pnpm build` into the same dist/ and both
# rebuild the same debug binary, and VITE_E2E_NATIVE_SEED is baked into that
# dist — so the binary embeds whichever build finished last, and a seed can
# capture another seed's frontend while reporting its own name in the filenames.
#
# Outputs: /tmp/lectrice-audit-<seed>-<theme>-<width>.png
set -euo pipefail
cd "$(dirname "$0")/.."

export TMPDIR=/tmp
# Geometry is the default contract, so default to a multi-card profile. The
# empty-state audit remains available explicitly as AUDIT_SEED=empty.
SEED="${AUDIT_SEED:-cover}"
case "$SEED" in
  empty)  TTS_ENV="none"; SEED_ENV="" ;;
  single) TTS_ENV="none"; SEED_ENV="single" ;;
  dual)   TTS_ENV="none"; SEED_ENV="dual" ;;
  cover)  TTS_ENV="none"; SEED_ENV="cover" ;;
  *) echo "ERROR: unknown AUDIT_SEED=$SEED (empty|single|dual|cover)" >&2; exit 2 ;;
esac
export AUDIT_SEED

E2E_PROFILE_DIR="$(mktemp -d /tmp/lectrice-audit-profile.XXXXXX)"
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR"
if [ "$SEED" = "cover" ]; then
  # The coverless book: right extension, wrong bytes — the cover pipeline must
  # fall back deterministically instead of ever writing a raster for it.
  printf 'not a pdf, just fixture bytes for the cover fallback lane\n' \
    > "$APP_DIR/e2e-coverless.pdf"
fi

# The receipt label must determine the baked seed. Do not inherit a caller's
# unrelated E2E mode/seed into an audit with a different name.
unset VITE_E2E VITE_E2E_NATIVE VITE_E2E_NATIVE_TTS VITE_E2E_NATIVE_SEED VITE_E2E_PROFILE_DIR

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=${SEED_ENV:-<none>})"
build_env=(VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS="$TTS_ENV")
[ -n "$SEED_ENV" ] && build_env+=(VITE_E2E_NATIVE_SEED="$SEED_ENV")
build_env+=(VITE_E2E_PROFILE_DIR="$APP_DIR")
env "${build_env[@]}" "$HOME/.local/share/pnpm/pnpm" build
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + running audit capture"
toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 2560x1440x24 3>$DISPNUM_FILE >/tmp/lectrice-audit-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start (no display number)"; exit 1; }
  export DISPLAY=:$DISPNUM
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  E2E_SPEC=./e2e/home-audit-capture.e2e.mjs "$HOME/.local/share/pnpm/pnpm" test:e2e
'
