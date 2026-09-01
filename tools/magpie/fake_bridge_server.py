#!/usr/bin/env python3
"""Launch the production bridge against explicit fake artifacts for tests only."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
from pathlib import Path

HERE = Path(__file__).parent
SPEC = importlib.util.spec_from_file_location(
    "lectrice_magpie_bridge", HERE / "lectrice_magpie_bridge.py"
)
assert SPEC and SPEC.loader
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--cli", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    args = parser.parse_args()
    bridge.PORT = args.port
    bridge.CLI = args.cli
    bridge.MODEL = args.model
    bridge.CLI_SHA256 = digest(args.cli)
    bridge.MODEL_SHA256 = digest(args.model)
    bridge.REVISION = f"magpie-fixture-{bridge.MODEL_SHA256[:16]}-chunk-v1"
    bridge.DEVICE = "Fixture Vulkan Device"
    bridge.main()


if __name__ == "__main__":
    main()
