#!/usr/bin/env python3
"""Capture Kokoro's native token timestamps ONCE into a committed fixture.

Run manually; the repo's tests never invoke this. Text is the app's own e2e
fixture sentence so the fixture is comparable with everything else in the repo.
"""

import hashlib
import json
import sys

# Importing kokoro pulls in misaki, which sets EspeakWrapper's class attributes
# to the espeakng-loader wheel's paths. Everything below therefore has to run
# AFTER this import — see the ESPEAK override.
from kokoro import KPipeline
from phonemizer.backend.espeak.wrapper import EspeakWrapper

TEXT = sys.argv[1] if len(sys.argv) > 1 else "alpha beta gamma delta epsilon"
VOICE = "af_heart"
LANG = "a"  # American English

# espeak-ng data path: the `espeakng-loader` wheel bakes its BUILD machine's
# path ("/home/runner/work/...") into the .so, so espeak dies on `phontab`.
# The class attributes misaki set at import time WIN over the environment
# variable PHONEMIZER_ESPEAK_DATA_PATH, so the override has to be set on the
# class itself, after kokoro/misaki is imported and before any pipeline exists.
ESPEAK = "/nix/store/kwm675bw75y615phbvr0p84gyni3lc83-espeak-ng-1.52.0.1-unstable-2025-09-09"
EspeakWrapper.set_library(f"{ESPEAK}/lib/libespeak-ng.so.1")
EspeakWrapper.set_data_path(f"{ESPEAK}/share/espeak-ng-data")

pipeline = KPipeline(lang_code=LANG)

chunks = []
for index, result in enumerate(pipeline(TEXT, voice=VOICE)):
    tokens = []
    for token in result.tokens or []:
        tokens.append(
            {
                "text": token.text,
                "whitespace": getattr(token, "whitespace", ""),
                "start_ts": getattr(token, "start_ts", None),
                "end_ts": getattr(token, "end_ts", None),
                "phonemes": getattr(token, "phonemes", None),
            }
        )
    audio = result.audio
    chunks.append(
        {
            "index": index,
            "graphemes": getattr(result, "graphemes", None),
            "audio_samples": int(audio.shape[-1]) if audio is not None else 0,
            "tokens": tokens,
        }
    )

fixture = {
    "provider": "kokoro",
    "kokoro_version": "0.9.4",
    "model": "hexgrad/Kokoro-82M",
    "lang_code": LANG,
    "voice": VOICE,
    "sample_rate": 24000,
    "text": TEXT,
    "cache_key": hashlib.sha256(f"kokoro|{LANG}|{VOICE}|{TEXT}".encode()).hexdigest(),
    "chunks": chunks,
}

# sort_keys + ensure_ascii=False so a re-capture is byte-identical to the
# committed fixture (IPA phonemes stay readable instead of \u-escaped).
json.dump(fixture, sys.stdout, indent=2, sort_keys=True, ensure_ascii=False)
print()
