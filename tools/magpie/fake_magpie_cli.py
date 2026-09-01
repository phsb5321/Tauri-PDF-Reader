#!/usr/bin/env python3
"""Deterministic fake for the Magpie bridge HTTP contract; never production."""

from __future__ import annotations

import argparse
import json
import os
import wave
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command")
    parser.add_argument("--model", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--lang", required=True)
    parser.add_argument("--speaker", required=True)
    parser.add_argument("--seed", required=True)
    parser.add_argument("--threads", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command != "say":
        raise SystemExit(2)
    text_bytes = len(args.text.encode("utf-8"))
    if text_bytes > 300:
        raise SystemExit(f"unsafe unsplit request: {text_bytes}")
    frames = max(2205, len(args.text) * 400)
    with wave.open(args.output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(22050)
        wav.writeframes(b"\x01\x00" * frames)
    trace = os.environ.get("LECTRICE_MAGPIE_FAKE_TRACE")
    if trace:
        with Path(trace).open("a", encoding="utf-8") as handle:
            handle.write(
                json.dumps(
                    {
                        "text": args.text,
                        "utf8Bytes": text_bytes,
                        "language": args.lang,
                        "speaker": args.speaker,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )


if __name__ == "__main__":
    main()
