# Requirements Quality Checklist: Account-Free Local Narration

- [x] User outcome is account-free narration, not model installation for its own sake.
- [x] Existing ElevenLabs behavior is explicitly preserved.
- [x] Destination ownership and disclosure are explicit.
- [x] WebView networking is forbidden; Rust trust boundary is explicit.
- [x] No cloud fallback after local dispatch is explicit.
- [x] Voice/catalog, request, media, response-size, and WAV failure modes are named.
- [x] Missing word marks are represented honestly rather than estimated as provider truth.
- [x] Timeout, cancellation, one-retry idempotency, strict WAV structure, and over-bound text behavior are explicit.
- [x] Natural finish/auto-page and explicit Stop are distinct deterministic outcomes.
- [x] Cache migration keeps legacy MP3 lookup and isolates local WAV identities.
- [x] Tunnel authentication, keepalive, health, persistence, and removal are explicit.
- [x] Mac deployment has a mechanical staging gate and retained rollback.
- [x] Full macOS UI journey remains BLOCKED unless a safe public-control actor exists; staging cannot clear it.
- [x] Success criteria are executable and distinguish transport, product composition, and subjective listening.
