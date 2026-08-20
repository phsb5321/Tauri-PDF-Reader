# Lectrice

> Every page, read aloud.

**Lectrice** is a local-first desktop PDF reader that reads documents aloud —
highlight a passage, press play, and let it continue across pages. Built with
Tauri 2.x (React/TypeScript + Rust).

The name is French for _a person employed to read aloud to someone_ — the app
is your lectrice. See [`docs/brand/`](docs/brand/) for the full brand system.

> **Version:** 0.2.0, built for **Linux (AppImage + deb)** — published
> artifacts come from the tagged commit, listed under
> [Releases](https://github.com/phsb5321/Tauri-PDF-Reader/releases); see
> [CHANGELOG.md](CHANGELOG.md) and
> [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md). macOS and Windows are
> **not yet covered by packaged builds or packaged tests** — see Platform
> support below.

## Features

What is in the tree today, with the receipt that proved it:

- Open and view local PDF files — offline; PDF resources (CMaps) are bundled
  locally, no CDN egress ([#97]).
- Text selection and highlighting, **persisted locally** and restored on
  reopen, and **surviving a quick window close** ([#102], [#113]) — as does
  your reading position ([#125]).
- Read a highlighted passage aloud with **AI text-to-speech (ElevenLabs)**
  ([#89], [#92]); requires an ElevenLabs API key (session-only, [#73]).
- Resume reading: the library shows where each book left off and one action
  lands on the right page ([#91], [#104], [#114]); narration starts when an
  ElevenLabs key is configured ([#89], [#92]) — otherwise the reader resumes
  silently and the home explains the setup ([SECURITY.md](SECURITY.md)).
- Library of local documents with reading progress ([#89]).
- Keyboard shortcuts that **derive from the real bindings** ([#111]).
- The interface adapts to the OS text size (rem, no fixed pixel font sizes;
  [#83], [#108], [#111]).

## Platform support

| Platform               | Packaged build         | Packaged E2E                               | Status                    |
| ---------------------- | ---------------------- | ------------------------------------------ | ------------------------- |
| Linux (AppImage + deb) | ✓ ([release workflow]) | ✓ (8 packaged E2E specs, WebKitGTK + Xvfb) | **only supported target** |
| macOS                  | ✗ not published        | ✗ not runnable (see below)                 | builds + launches only    |
| Windows                | ✗ not produced         | ✗ not run                                  | not yet covered           |

A macOS build has been made and launched by hand (macOS 26.6.1/arm64, bundle
`0.2.0`), but no macOS journey can be driven: the window exposes no
accessibility children, the app registers no file association, and
`tauri-driver` has no macOS support. Details in
[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

There is **no packaged evidence for macOS or Windows** in this repository —
treat the hand-run macOS build above as exactly that, one manual observation,
and do not assume a working install there until a published artifact and a
packaged E2E pass exist for it. The self-hosted release runner is Linux-only.
The macOS and Windows prerequisites below are the upstream Tauri prerequisites,
documented for future work, not claims about this app.

### All Platforms (upstream Tauri prerequisites)

- **Node.js**: 18+ (LTS recommended)
- **pnpm**: 8+
- **Rust**: 1.75+

### Linux (Ubuntu/Debian)

```bash
# System dependencies for Tauri
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### macOS

```bash
# Xcode Command Line Tools (upstream prerequisite; no packaged build yet)
xcode-select --install
```

### Windows

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"
2. WebView2 is typically pre-installed on Windows 10+

## AI text-to-speech

Lectrice speaks through **ElevenLabs** (the `elevenlabs-tts` feature is the
default build). The page text you ask to be read aloud is sent to
`api.elevenlabs.io` — see [SECURITY.md](SECURITY.md) for the exact egress
contract. The API key is session-only ([#73]).

There is also a `native-tts` Cargo feature (Speech Dispatcher), **not enabled
by default** and not part of any shipped build yet. The packaged E2E suites use
a deterministic fixture engine ([#101]); the live ElevenLabs path is not
exercised in CI.

## Configuration file

Lectrice reads an optional TOML config file at startup:

```
$XDG_CONFIG_HOME/lectrice/config.toml     # usually ~/.config/lectrice/config.toml
```

Set `LECTRICE_CONFIG=/path/to/file.toml` to override the path entirely.

The file is **optional and never created for you** — with no file present,
Lectrice uses its built-in defaults and writes nothing. To start from a
commented template covering every key:

```bash
lectrice --generate-config > ~/.config/lectrice/config.toml
```

Every key is optional, so a two-line file is valid:

```toml
[appearance]
theme = "dark"
```

Behaviour worth knowing:

- **An unknown key warns, it never fails.** A typo (or a key from a newer
  Lectrice) is reported by name and ignored; the app still starts.
- **A type error names the key and the position** — and the whole file is
  skipped in favour of the built-in defaults, so you never get a half-applied
  config:

  ```
  config.toml:3:8: key `tts.rate`: invalid type: string "fast", expected f64
  ```
- **Out-of-range values are clamped, with a warning**, to the same bounds the
  UI enforces.
- **Secrets do not belong here.** The ElevenLabs API key is entered at runtime
  and is deliberately not a config key.

The file composes with `home-manager`:

```nix
xdg.configFile."lectrice/config.toml".source = ./lectrice.toml;
```

Slice 1 (this release) is **read-only**: the file is applied at startup. The
Settings UI still writes its own store; making the UI a comment-preserving
writer of this file, and hot-reloading it on change, are the next two slices.
See [`specs/078-config-file/spec.md`](specs/078-config-file/spec.md).

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm tauri dev

# Build production (Linux)
pnpm tauri build
```

Verification (in this order, to keep this machine responsive):

```bash
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit
pnpm test:run        # vitest unit/integration (jsdom, CI)
cd src-tauri && cargo test --features test-mocks -j 1   # Rust, single-threaded
./scripts/verify.sh  # full gate (CI parity) — heavy, only before final commit
```

Packaged E2E (Linux, needs the `nix` devShell + Xvfb; **not** run in CI):

```bash
pnpm test:e2e:all    # critical-loop + native-play
bash e2e/run-close-journey.sh   # close-and-relaunch data-loss lanes
bash e2e/run-highlight-journey.sh
bash e2e/run-open-journey.sh
bash e2e/run-reader-journey.sh
bash e2e/run-session-journey.sh
pnpm test:user-gate  # fuzz + packaged lanes
```

## Project structure

```
tauri-pdf-reader/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # React components
│   ├── services/             # API services
│   ├── stores/               # Zustand stores
│   ├── lib/                  # Utilities
│   ├── ports/                # Hexagonal ports
│   └── styles/               # CSS
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri commands
│   │   ├── ai_tts/           # ElevenLabs TTS engine + player
│   │   ├── db/               # SQLite models/migrations
│   │   └── tts/              # Native TTS engine (feature-gated)
│   └── capabilities/         # Permission capabilities
├── e2e/                      # Packaged E2E lanes (WebdriverIO, Linux)
├── docs/                     # Architecture, brand, UI, ops, backlog
└── SECURITY.md               # Egress + data contract
```

## License

Private - All rights reserved.

[#97]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/97
[#73]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/73
[#89]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/89
[#91]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/91
[#92]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/92
[#101]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/101
[#102]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/102
[#104]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/104
[#111]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/111
[#113]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/113
[#114]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/114
[#125]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/125
[#83]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/83
[#108]: https://github.com/phsb5321/Tauri-PDF-Reader/pull/108
[release workflow]: .github/workflows/release.yml
