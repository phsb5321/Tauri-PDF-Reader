#!/usr/bin/env python3
"""Hermetic Proso-contract TTS fixture for Lectrice packaged E2E."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path


def wav_bytes() -> bytes:
    output = BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16_000)
        wav.writeframes(b"\0\0" * 32_000)  # 2 seconds for observable playback.
    return output.getvalue()


class State:
    def __init__(self, log: Path) -> None:
        self.log = log
        self.cache: dict[str, tuple[str, bytes]] = {}
        self.audio = wav_bytes()

    def record(self, row: dict[str, object]) -> None:
        with self.log.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


class Handler(BaseHTTPRequestHandler):
    server: "FixtureServer"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def json_response(self, body: dict[str, object], status: int = 200) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.json_response({"status": "ok", "ready": True, "version": "fixture-1"})
        elif self.path == "/v1/capabilities":
            self.json_response(
                {
                    "status": "ok",
                    "ready": True,
                    "limits": {"maxTextUtf8Bytes": 8192},
                    "tts": {
                        "voices": [
                            {
                                "id": "F1-pt",
                                "language": "pt-BR",
                                "mediaTypes": ["audio/wav"],
                                "markKinds": [],
                            }
                        ]
                    },
                }
            )
        elif self.path == "/requests":
            rows = []
            if self.server.state.log.exists():
                rows = [json.loads(line) for line in self.server.state.log.read_text().splitlines()]
            self.json_response({"requests": rows})
        else:
            self.json_response({"error": "not_found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/tts":
            self.json_response({"error": "not_found"}, 404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        body = json.loads(raw)
        key = self.headers.get("Idempotency-Key", "")
        identity = hashlib.sha256(
            f"{body.get('input')}\0{body.get('voice')}\0{body.get('speed')}".encode()
        ).hexdigest()
        cached = self.server.state.cache.get(key)
        if cached and cached[0] != identity:
            self.json_response({"error": "idempotency_key_reused"}, 409)
            return
        self.server.state.cache[key] = (identity, self.server.state.audio)
        self.server.state.record({"body": body, "idempotencyKey": key})
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(self.server.state.audio)))
        self.end_headers()
        self.wfile.write(self.server.state.audio)


class FixtureServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], state: State) -> None:
        super().__init__(address, Handler)
        self.state = state


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--ready", type=Path, required=True)
    args = parser.parse_args()
    args.log.unlink(missing_ok=True)
    args.ready.unlink(missing_ok=True)
    server = FixtureServer(("127.0.0.1", 5301), State(args.log))
    args.ready.write_text("ready\n")
    server.serve_forever()


if __name__ == "__main__":
    main()
