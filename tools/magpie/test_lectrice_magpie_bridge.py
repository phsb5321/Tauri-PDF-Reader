#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import Mock, patch

MODULE_PATH = Path(__file__).with_name("lectrice_magpie_bridge.py")
SPEC = importlib.util.spec_from_file_location("lectrice_magpie_bridge", MODULE_PATH)
assert SPEC and SPEC.loader
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


def write_wav(
    path: Path,
    *,
    frames: int = 2205,
    channels: int = 1,
    sample_width: int = 2,
    sample_rate: int = 22050,
) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(sample_width)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x01\x00" * frames * channels)


class ChunkingTests(unittest.TestCase):
    def test_real_page_shape_is_lossless_and_bounded(self) -> None:
        sentence = (
            "Data systems must remain understandable under load, and every boundary "
            "must preserve the source. "
        )
        text = (sentence * 30)[:2233]
        chunks = bridge.split_text_utf8(text, 300)
        self.assertEqual("".join(chunks), text)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(0 < len(chunk.encode("utf-8")) <= 300 for chunk in chunks))
        self.assertTrue(all(chunk[-1].isspace() for chunk in chunks[:-1]))

    def test_unicode_and_overlong_word_fall_back_to_scalar_boundaries(self) -> None:
        text = "ação 😀 " + ("hiperlongapalavra" * 30) + " fim."
        chunks = bridge.split_text_utf8(text, 40)
        self.assertEqual("".join(chunks), text)
        self.assertTrue(all(len(chunk.encode("utf-8")) <= 40 for chunk in chunks))

    def test_ceiling_smaller_than_one_scalar_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            bridge.split_text_utf8("😀", 3)


class ResponseBoundaryTests(unittest.TestCase):
    def test_client_disconnect_is_not_an_engine_failure(self) -> None:
        handler = bridge.Handler.__new__(bridge.Handler)
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        handler.wfile = Mock()
        handler.wfile.write.side_effect = BrokenPipeError("client cancelled")

        with patch("builtins.print") as output:
            delivered = handler.send_payload(200, "audio/wav", b"audio")

        self.assertFalse(delivered)
        output.assert_called_once()
        self.assertIn("client disconnected", output.call_args.args[0])
        self.assertNotIn("engine", output.call_args.args[0])


class WavTests(unittest.TestCase):
    def test_concatenates_homogeneous_pcm16_without_losing_frames(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first, second, output = root / "a.wav", root / "b.wav", root / "out.wav"
            write_wav(first, frames=100)
            write_wav(second, frames=250)
            bridge.concatenate_pcm16_wavs([first, second], output)
            with wave.open(str(output), "rb") as wav:
                self.assertEqual(wav.getnframes(), 350)
                self.assertEqual(wav.getnchannels(), 1)
                self.assertEqual(wav.getsampwidth(), 2)
                self.assertEqual(wav.getframerate(), 22050)

    def test_rejects_mismatched_geometry(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first, second, output = root / "a.wav", root / "b.wav", root / "out.wav"
            write_wav(first)
            write_wav(second, sample_rate=44100)
            with self.assertRaisesRegex(RuntimeError, "geometry"):
                bridge.concatenate_pcm16_wavs([first, second], output)

    def test_rejects_non_pcm16(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "bad.wav"
            write_wav(path, sample_width=1)
            with self.assertRaisesRegex(RuntimeError, "unsupported"):
                bridge.read_pcm16_wav(path)


if __name__ == "__main__":
    unittest.main()
