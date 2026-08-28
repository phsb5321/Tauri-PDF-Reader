#!/usr/bin/env bash
# Deterministic source-alignment + PCM-boundary oracle for issues #188/#189.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

if rg -n 'eleven_monolingual_v1' src-tauri/src; then
  echo 'e2e-prosody: removed ElevenLabs model remains in runtime source' >&2
  exit 1
fi
rg -q 'ELEVEN_DEFAULT_MODEL_ID: &str = "eleven_multilingual_v2"' \
  src-tauri/src/ai_tts/elevenlabs.rs

./node_modules/.bin/vitest run \
  src/lib/prosody-plan.test.ts \
  src/lib/pdf-text.test.ts \
  src/__tests__/ui/sentence-playback.test.tsx \
  src/__tests__/integration/karaoke-sync.test.ts \
  --pool=forks --poolOptions.forks.singleFork
./node_modules/.bin/tsc --noEmit

export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$HOME/.cache/lectrice/prosody-gate-target}
# shellcheck source=./e2e-toolchain.sh
source "$ROOT/scripts/e2e-toolchain.sh"
toolchain_run 'set -euo pipefail
  cd src-tauri
  cargo fmt --check
  cargo test current_eleven_model --features test-mocks -j 1
  cargo test prosody_revision_contract --features test-mocks -j 1
  cargo test prosody_boundary_targets --features test-mocks -j 1
  cargo test equalizer_ --features test-mocks -j 1
  cargo clippy --features test-mocks -- -D warnings'

make harness-check
printf 'e2e-prosody: PASS\n'
