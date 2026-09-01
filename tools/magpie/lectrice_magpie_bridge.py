#!/usr/bin/env python3
"""Pinned loopback Lectrice TTS bridge for Magpie Q6 on Vulkan/RADV."""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
import threading
import time
import wave
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, NamedTuple

HOST = "127.0.0.1"
PORT = int(os.environ.get("LECTRICE_MAGPIE_PORT", "5301"))
DEFAULT_CANDIDATE = (
    Path.home()
    / "tts-bench-20260822-desktop/gpu-voice-audit-20260823/magpie-q6-candidate"
)
CLI = Path(os.environ.get("LECTRICE_MAGPIE_CLI", DEFAULT_CANDIDATE / "bin/magpie-cli"))
MODEL = Path(
    os.environ.get(
        "LECTRICE_MAGPIE_MODEL",
        DEFAULT_CANDIDATE / "model/magpie-tts-multilingual-357m-q6_k.gguf",
    )
)
MODEL_SHA256 = "8291ffde2e13e2e9221a000669b5f7814c7ecc858eb0a1a9de8ee77d8da05736"
CLI_SHA256 = "d2d0ebe35ef0e918dabe8d5de38740dcc4b951086c7d871e22b3c08d435c78b6"
REVISION = f"magpie-q6-vulkan-{MODEL_SHA256[:16]}-chunk-v1"
MODEL_NAME = "Magpie TTS Multilingual 357M"
QUANTIZATION = "Q6_K"
BACKEND = "Vulkan/RADV"
DEVICE = os.environ.get("LECTRICE_MAGPIE_DEVICE_NAME", "AMD Radeon RX 5700 XT")
SPEAKERS = ("Aria", "Jason", "John", "Leo", "Sofia")
VOICE_MAP = {
    **{f"{speaker}-en": (speaker, "en") for speaker in SPEAKERS},
    **{f"{speaker}-pt-BR": (speaker, "pt-BR") for speaker in SPEAKERS},
}
PREFERRED_CHUNK_UTF8_BYTES = 300
MAX_REQUEST_UTF8_BYTES = 8_192
MAX_BODY_BYTES = 16 * 1024
MAX_AUDIO_BYTES = 64 * 1024 * 1024
CACHE_TTL_SECONDS = 900
CACHE_ITEMS = 8
CHUNK_TIMEOUT_SECONDS = 45
FFMPEG = os.environ.get("LECTRICE_MAGPIE_FFMPEG", "/run/current-system/sw/bin/ffmpeg")
THREADS = int(os.environ.get("LECTRICE_MAGPIE_THREADS", str(min(22, os.cpu_count() or 1))))

synthesis_lock = threading.Lock()
response_cache: OrderedDict[str, tuple[float, str, bytes]] = OrderedDict()


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


def problem(status: int, code: str, detail: str) -> tuple[int, str, bytes]:
    return (
        status,
        "application/problem+json",
        json_bytes(
            {
                "type": f"about:blank#{code}",
                "title": code.replace("_", " "),
                "status": status,
                "code": code,
                "detail": detail,
                "retryable": status >= 500,
            }
        ),
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_candidate() -> None:
    for path, expected, label in (
        (CLI, CLI_SHA256, "CLI"),
        (MODEL, MODEL_SHA256, "model"),
    ):
        if not path.is_file():
            raise SystemExit(f"missing Magpie {label} artifact: {path}")
        actual = sha256_file(path)
        if actual != expected:
            raise SystemExit(f"Magpie {label} hash mismatch: {actual}")


def _max_prefix_end(text: str, start: int, max_bytes: int) -> int:
    used = 0
    end = start
    while end < len(text):
        width = len(text[end].encode("utf-8"))
        if used + width > max_bytes:
            break
        used += width
        end += 1
    if end == start:
        raise ValueError("chunk ceiling is smaller than one Unicode scalar")
    return end


def split_text_utf8(text: str, max_bytes: int = PREFERRED_CHUNK_UTF8_BYTES) -> list[str]:
    """Losslessly split at sentence, whitespace, then Unicode-scalar boundaries."""
    if not text:
        return []
    if max_bytes < 4:
        raise ValueError("chunk ceiling must accommodate one UTF-8 scalar")

    chunks: list[str] = []
    cursor = 0
    sentence_break = re.compile(r"[.!?…][\"')\]]*\s+", re.UNICODE)
    whitespace_break = re.compile(r"\s+", re.UNICODE)
    while cursor < len(text):
        hard_end = _max_prefix_end(text, cursor, max_bytes)
        if hard_end == len(text):
            cut = hard_end
        else:
            window = text[cursor:hard_end]
            sentence_matches = list(sentence_break.finditer(window))
            whitespace_matches = list(whitespace_break.finditer(window))
            if sentence_matches:
                cut = cursor + sentence_matches[-1].end()
            elif whitespace_matches:
                cut = cursor + whitespace_matches[-1].end()
            else:
                cut = hard_end
        if cut <= cursor:
            raise RuntimeError("Magpie chunker made no progress")
        chunk = text[cursor:cut]
        if len(chunk.encode("utf-8")) > max_bytes:
            raise RuntimeError("Magpie chunk exceeded its UTF-8 ceiling")
        chunks.append(chunk)
        cursor = cut

    if "".join(chunks) != text or any(not chunk for chunk in chunks):
        raise RuntimeError("Magpie chunker changed source text")
    return chunks


class WavGeometry(NamedTuple):
    channels: int
    sample_width: int
    sample_rate: int
    compression_type: str
    compression_name: str


def read_pcm16_wav(path: Path) -> tuple[WavGeometry, bytes]:
    with wave.open(str(path), "rb") as wav:
        geometry = WavGeometry(
            wav.getnchannels(),
            wav.getsampwidth(),
            wav.getframerate(),
            wav.getcomptype(),
            wav.getcompname(),
        )
        if geometry.channels not in (1, 2) or geometry.sample_width != 2:
            raise RuntimeError("Magpie emitted unsupported WAV format")
        if not 8_000 <= geometry.sample_rate <= 96_000 or wav.getnframes() <= 0:
            raise RuntimeError("Magpie emitted invalid WAV geometry")
        if geometry.compression_type != "NONE":
            raise RuntimeError("Magpie emitted compressed WAV")
        return geometry, wav.readframes(wav.getnframes())


def concatenate_pcm16_wavs(paths: list[Path], destination: Path) -> None:
    if not paths:
        raise RuntimeError("Magpie emitted no chunks")
    geometry: WavGeometry | None = None
    total_bytes = 0
    with wave.open(str(destination), "wb") as output:
        for path in paths:
            current, frames = read_pcm16_wav(path)
            if geometry is None:
                geometry = current
                output.setnchannels(current.channels)
                output.setsampwidth(current.sample_width)
                output.setframerate(current.sample_rate)
                output.setcomptype(current.compression_type, current.compression_name)
            elif current != geometry:
                raise RuntimeError("Magpie chunks disagree on WAV geometry")
            total_bytes += len(frames)
            if total_bytes + 44 > MAX_AUDIO_BYTES:
                raise RuntimeError("generated WAV exceeds the response limit")
            output.writeframesraw(frames)
        output.writeframes(b"")


def validate_wav(path: Path) -> bytes:
    data = path.read_bytes()
    if len(data) > MAX_AUDIO_BYTES:
        raise RuntimeError("generated WAV exceeds the response limit")
    read_pcm16_wav(path)
    return data


def _run_chunk(text: str, voice: str, destination: Path) -> float:
    speaker, language = VOICE_MAP[voice]
    command = [
        str(CLI),
        "say",
        "--model",
        str(MODEL),
        "--text",
        text,
        "--lang",
        language,
        "--speaker",
        speaker,
        "--seed",
        "42",
        "--threads",
        str(max(1, THREADS)),
        "--output",
        str(destination),
    ]
    started = time.monotonic()
    result = subprocess.run(
        command,
        env={**os.environ, "MAGPIE_DEVICE": "auto"},
        capture_output=True,
        text=True,
        timeout=CHUNK_TIMEOUT_SECONDS,
        check=False,
    )
    elapsed = time.monotonic() - started
    if result.stderr:
        print(f"magpie-cli diagnostic bytes={len(result.stderr)}", flush=True)
    if result.returncode != 0:
        raise RuntimeError(f"magpie-cli exited {result.returncode}")
    return elapsed


def synthesize(text: str, voice: str, speed: float) -> bytes:
    chunks = split_text_utf8(text)
    cache_dir = Path.home() / ".cache/lectrice-magpie-bridge"
    cache_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="request-", dir=cache_dir) as temp:
        temp_dir = Path(temp)
        sources: list[Path] = []
        elapsed = 0.0
        for index, chunk in enumerate(chunks):
            source = temp_dir / f"chunk-{index:03d}.wav"
            elapsed += _run_chunk(chunk, voice, source)
            sources.append(source)
        combined = temp_dir / "combined.wav"
        concatenate_pcm16_wavs(sources, combined)
        output = combined
        if abs(speed - 1.0) > 0.000_001:
            adjusted = temp_dir / "speech-speed.wav"
            subprocess.run(
                [
                    FFMPEG,
                    "-nostdin",
                    "-loglevel",
                    "error",
                    "-i",
                    str(combined),
                    "-filter:a",
                    f"atempo={speed:.6f}",
                    "-acodec",
                    "pcm_s16le",
                    "-ar",
                    "22050",
                    "-ac",
                    "1",
                    str(adjusted),
                ],
                timeout=30,
                check=True,
            )
            output = adjusted
        audio = validate_wav(output)
        print(
            "synthesized "
            f"voice={voice} chars={len(text)} chunks={len(chunks)} "
            f"chunk_bytes={[len(chunk.encode('utf-8')) for chunk in chunks]} "
            f"audio_bytes={len(audio)} elapsed={elapsed:.3f}s",
            flush=True,
        )
        return audio


def prune_cache(now: float) -> None:
    expired = [
        key
        for key, (stamp, _, _) in response_cache.items()
        if now - stamp > CACHE_TTL_SECONDS
    ]
    for key in expired:
        response_cache.pop(key, None)
    while len(response_cache) > CACHE_ITEMS:
        response_cache.popitem(last=False)


class Handler(BaseHTTPRequestHandler):
    server_version = "LectriceMagpieBridge/2"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.client_address[0]} {fmt % args}", flush=True)

    def send_payload(
        self, status: int, media_type: str, body: bytes, **headers: str
    ) -> bool:
        try:
            self.send_response(status)
            self.send_header("Content-Type", media_type)
            self.send_header("Content-Length", str(len(body)))
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError) as error:
            print(
                "client disconnected before response delivery: "
                f"{type(error).__name__}",
                flush=True,
            )
            return False
        return True

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_payload(
                200,
                "application/json",
                json_bytes({"status": "ok", "ready": True, "version": REVISION}),
            )
            return
        if self.path == "/v1/capabilities":
            voices = [
                {
                    "id": voice,
                    "language": "pt-BR" if voice.endswith("-pt-BR") else "en-US",
                    "mediaTypes": ["audio/wav"],
                    "markKinds": [],
                }
                for voice in VOICE_MAP
            ]
            self.send_payload(
                200,
                "application/json",
                json_bytes(
                    {
                        "status": "ok",
                        "ready": True,
                        "limits": {
                            "maxTextUtf8Bytes": PREFERRED_CHUNK_UTF8_BYTES,
                            "idempotencyRetentionSeconds": CACHE_TTL_SECONDS,
                            "queueCapacity": 1,
                        },
                        "runtime": {
                            "model": MODEL_NAME,
                            "modelRevision": MODEL_SHA256,
                            "quantization": QUANTIZATION,
                            "backend": BACKEND,
                            "device": DEVICE,
                            "acceleration": "gpu",
                            "chunkMaxUtf8Bytes": PREFERRED_CHUNK_UTF8_BYTES,
                        },
                        "tts": {"voices": voices},
                    }
                ),
            )
            return
        self.send_payload(*problem(404, "not_found", self.path))

    def do_POST(self) -> None:
        if self.path != "/v1/tts":
            self.send_payload(*problem(404, "not_found", self.path))
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_payload(
                *problem(400, "invalid_content_length", "Content-Length is invalid")
            )
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_payload(
                *problem(413, "payload_too_large", "Request body is outside the limit")
            )
            return
        key = self.headers.get("Idempotency-Key")
        if not key or not 16 <= len(key) <= 128:
            self.send_payload(
                *problem(
                    422,
                    "idempotency_key_required",
                    "A 16-128 character key is required",
                )
            )
            return
        try:
            body = json.loads(self.rfile.read(length))
            text = body["input"]
            voice = body["voice"]
            speed = float(body["speed"])
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.send_payload(
                *problem(422, "invalid_input", "Expected input, voice, and speed")
            )
            return
        if not isinstance(text, str) or not text.strip():
            self.send_payload(*problem(422, "invalid_input", "Input text is empty"))
            return
        if len(text.encode("utf-8")) > MAX_REQUEST_UTF8_BYTES:
            self.send_payload(
                *problem(413, "payload_too_large", "Input exceeds the request limit")
            )
            return
        if voice not in VOICE_MAP:
            self.send_payload(
                *problem(422, "unknown_voice", f"Unknown voice: {voice}")
            )
            return
        if not 0.7 <= speed <= 2.0:
            self.send_payload(
                *problem(422, "invalid_speed", "Speed must be in 0.7..=2.0")
            )
            return

        identity = hashlib.sha256(
            json.dumps(
                {"input": text, "voice": voice, "speed": speed},
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        try:
            with synthesis_lock:
                now = time.monotonic()
                prune_cache(now)
                cached = response_cache.get(key)
                if cached is not None:
                    _, cached_identity, audio = cached
                    if cached_identity != identity:
                        self.send_payload(
                            *problem(
                                409,
                                "idempotency_key_reused",
                                "Key was used for another request",
                            )
                        )
                        return
                    response_cache.move_to_end(key)
                    self.send_payload(
                        200, "audio/wav", audio, **{"X-Cache-Hit": "true"}
                    )
                    return
                audio = synthesize(text, voice, speed)
                response_cache[key] = (now, identity, audio)
                prune_cache(now)
            self.send_payload(200, "audio/wav", audio, **{"X-Cache-Hit": "false"})
        except subprocess.TimeoutExpired:
            self.send_payload(
                *problem(504, "synthesis_timeout", "Magpie chunk exceeded its deadline")
            )
        except Exception as error:  # request boundary: structured local failure
            print(f"synthesis failed: {type(error).__name__}", flush=True)
            self.send_payload(
                *problem(500, "engine_failed", "Local synthesis failed")
            )


def main() -> None:
    validate_candidate()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(
        f"Lectrice Magpie Q6 bridge ready on http://{HOST}:{PORT} "
        f"revision={REVISION} backend={BACKEND} device={DEVICE}",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
