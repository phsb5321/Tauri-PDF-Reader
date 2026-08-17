#!/usr/bin/env bash
#
# S1 card-fold verify (gap #1 of the 16/08/2026 home audit) — the packaged
# gate: a library card's text (title / pages / progress) must be visible
# WITHOUT scrolling inside the grid, for seeds single | dual | cover in both
# themes.
#
# Ported from the audit's home-audit-capture.sh (one seed per invocation →
# this runner loops all three seeds against ONE cargo build).
#
# Hermetic profile pinned under /tmp (assert_hermetic_profile refuses to boot
# outside /tmp; this host's default TMPDIR is /var/tmp).
#   bash scripts/card-fold-verify.sh        (gate: any fold violation = red)
#   CARD_AUDIT=1 bash scripts/card-fold-verify.sh  (report measurements, no assert)
set -euo pipefail
cd "$(dirname "$0")/.."

export TMPDIR=/tmp
export CARD_AUDIT="${CARD_AUDIT:-0}"

# One hermetic profile per seed, all under /tmp.
for SEED in single dual cover; do
  export AUDIT_SEED="$SEED"
  E2E_PROFILE_DIR="$(mktemp -d /tmp/lectrice-s1-profile.XXXXXX)"
  source ./scripts/e2e-profile.sh
  source ./scripts/e2e-toolchain.sh
  APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
  mkdir -p "$APP_DIR"
  node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null
  if [ "$SEED" = "cover" ]; then
    # The coverless book: right extension, wrong bytes — the cover pipeline
    # must fall back deterministically instead of ever writing a raster.
    printf 'not a pdf, just fixture bytes for the cover fallback lane\n' \
      > "$APP_DIR/e2e-coverless.pdf"
  fi

  echo "==> [$SEED] Building frontend (VITE_E2E_NATIVE=true)"
  env VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none \
    VITE_E2E_NATIVE_SEED="$SEED" \
    VITE_E2E_PROFILE_DIR="$APP_DIR" pnpm build >/dev/null
  touch src-tauri/src/lib.rs

  # First seed also builds the debug binary; later seeds reuse it.
  # The Tauri debug binary EMBEDS the frontend dist (generate_context!): a
  # per-seed frontend build is only visible to the app if the binary is
  # rebuilt after it — otherwise every seed runs the first build's UI.
  toolchain_run '
    set -euo pipefail
    ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
    echo "==> debug binary rebuilt (seed frontend embedded)"
  '

  toolchain_run '
    set -euo pipefail
    export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
    export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
    export GDK_BACKEND=x11
    DISPNUM_FILE=$(mktemp)
    Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-s1-xvfb.log 2>&1 &
    XVFB_PID=$!
    trap "kill $XVFB_PID 2>/dev/null || true" EXIT
    for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
    DISPNUM=$(cat $DISPNUM_FILE)
    [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start" >&2; exit 1; }
    export DISPLAY=:$DISPNUM
    echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
    E2E_SPEC=./e2e/card-fold-verify.e2e.mjs pnpm test:e2e
  '
done
