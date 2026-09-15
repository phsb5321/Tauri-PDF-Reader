# Lectrice Magpie Q6 Vulkan bridge

This loopback bridge adapts the audited `magpie-tts.cpp` Vulkan build and Magpie Multilingual 357M Q6_K weights to Lectrice's local TTS contract.

The binary and model are deliberately **not** committed. Defaults point to the retained local audit artifacts:

```text
~/tts-bench-20260822-desktop/gpu-voice-audit-20260823/magpie-q6-candidate/
```

Pinned digests:

- CLI: `d2d0ebe35ef0e918dabe8d5de38740dcc4b951086c7d871e22b3c08d435c78b6`
- model: `8291ffde2e13e2e9221a000669b5f7814c7ecc858eb0a1a9de8ee77d8da05736`

The runtime is MIT; the NVIDIA model weights retain their NVIDIA Open Model License. Review the retained license before redistribution.

## Run

```bash
tools/magpie/start-transient.sh
curl -fsS http://127.0.0.1:5301/v1/capabilities | jq '{limits,runtime}'
```

The service advertises a 300-byte production unit ceiling. It also defensively accepts one request up to 8,192 bytes and losslessly splits it into sequential ≤300-byte sentence/word units. Lectrice remains the primary queue owner so first audio and cancellation do not wait for a full-page response.

## Verify

```bash
tools/magpie/verify-bridge.sh    # fake CLI, chunk/WAV/HTTP/idempotency contracts
tools/magpie/verify-real-page.sh # pinned model, held-out PDF, RTF + GPU/VRAM proof
```

`verify-real-page.sh` requires `pdftotext`, `jq`, `curl`, the retained PDF fixture, and readable amdgpu VRAM sysfs counters.

## Roll back

```bash
systemctl --user stop lectrice-magpie-desktop.service
~/tts-bench-20260822-desktop/supertonic3/start-transient.sh
```

There is no automatic fallback. A failed Magpie service leaves Local TTS unavailable until the operator explicitly restores another service on the same pinned loopback destination.
