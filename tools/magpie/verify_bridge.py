#!/usr/bin/env python3
"""Validate a fake-model bridge run retained by verify-bridge.sh."""

from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

root = Path(sys.argv[1])
request = json.loads((root / "request.json").read_text())
trace = [json.loads(line) for line in (root / "trace.jsonl").read_text().splitlines()]
assert len(request["input"]) == 2233
assert len(trace) > 1
assert "".join(item["text"] for item in trace) == request["input"]
assert all(0 < item["utf8Bytes"] <= 300 for item in trace)
with wave.open(str(root / "page.wav"), "rb") as wav:
    assert wav.getsampwidth() == 2
    assert wav.getnchannels() == 1
    assert wav.getframerate() == 22050
    seconds = wav.getnframes() / wav.getframerate()
    assert seconds > 30, seconds
print(json.dumps({"status": "PASS", "chunks": len(trace), "seconds": seconds}))
