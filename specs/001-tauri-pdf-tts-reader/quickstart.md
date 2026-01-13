# Quickstart: Tauri PDF Reader with TTS and Highlights

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Date**: 2026-01-11

## Prerequisites

- **Node.js**: 18+
- **pnpm**: 8+
- **Rust**: 1.75+
- **Platform Requirements**:
  - **Windows**: No additional requirements
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `speech-dispatcher`, `libspeechd-dev`, `webkit2gtk-4.1`, `libappindicator3-1`

## Quick Start

```bash
# Clone and enter directory
cd tauri-pdf-reader

# Install dependencies
pnpm install

# Run development server
pnpm tauri dev
```

The app opens with hot reload enabled. Changes to frontend code reload instantly; Rust changes trigger recompilation.

## Project Structure

```
tauri-pdf-reader/
├── src/                      # Frontend (React/TypeScript)
│   ├── components/           # UI components
│   ├── stores/               # Zustand state management
│   ├── lib/                  # Utilities and schemas
│   └── App.tsx               # Root component
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands
│   │   ├── db/               # Database layer
│   │   ├── tts/              # TTS engine (feature-gated)
│   │   └── main.rs           # Entry point
│   ├── Cargo.toml
│   └── tauri.conf.json       # App configuration
├── specs/                    # Feature specifications
└── tests/                    # Test suites
```

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm tauri dev` | Start development with hot reload |
| `pnpm tauri build` | Build production release |
| `pnpm build` | Type-check and build frontend only |
| `pnpm lint` | Run ESLint |
| `cd src-tauri && cargo check` | Check Rust code |
| `cd src-tauri && cargo test` | Run Rust tests |
| `cd src-tauri && cargo build --features native-tts` | Build with TTS enabled |

## Development Workflow

### Frontend Development

1. Components in `src/components/`
2. State management in `src/stores/` (Zustand)
3. Tauri IPC calls via `src/lib/tauri-invoke.ts`
4. Types/schemas in `src/lib/schemas.ts` (Zod)

### Backend Development

1. Commands in `src-tauri/src/commands/`
2. Register commands in `src-tauri/src/lib.rs`
3. Database models in `src-tauri/src/db/models.rs`
4. Use `#[serde(rename_all = "camelCase")]` for JSON serialization

### Adding a New Tauri Command

**Rust side** (`src-tauri/src/commands/example.rs`):
```rust
#[tauri::command]
pub async fn my_command(
    db: State<'_, DbInstances>,
    input: String,
) -> Result<MyOutput, String> {
    // Implementation
}
```

**Register** (`src-tauri/src/lib.rs`):
```rust
.invoke_handler(tauri::generate_handler![
    commands::example::my_command,
])
```

**Frontend** (`src/lib/tauri-invoke.ts`):
```typescript
export async function myCommand(input: string): Promise<MyOutput> {
  return invoke('my_command', { input });
}
```

## Database

- **Location**: App data directory (`pdf-reader.db`)
- **Engine**: SQLite via `tauri-plugin-sql`
- **Migrations**: Run on app startup from `src-tauri/src/db/migrations.rs`

### Query Example
```rust
let result = sqlx::query_as::<_, Document>(
    "SELECT * FROM documents WHERE id = ?"
)
.bind(&id)
.fetch_one(&pool)
.await?;
```

## TTS Feature

TTS is behind a feature flag. To enable:

```bash
cd src-tauri
cargo build --features native-tts
```

Or in `Cargo.toml`:
```toml
[features]
default = ["native-tts"]
native-tts = ["tts"]
```

## Testing

### Frontend Tests
```bash
pnpm test           # Run Vitest
pnpm test:coverage  # With coverage
```

### Backend Tests
```bash
cd src-tauri
cargo test
cargo test --features native-tts  # Include TTS tests
```

### E2E Tests
```bash
pnpm test:e2e       # Requires tauri-driver
```

## Build for Production

```bash
# All platforms
pnpm tauri build

# Platform-specific
pnpm tauri build --target x86_64-pc-windows-msvc    # Windows
pnpm tauri build --target x86_64-apple-darwin       # macOS Intel
pnpm tauri build --target aarch64-apple-darwin      # macOS ARM
pnpm tauri build --target x86_64-unknown-linux-gnu  # Linux
```

Output: `src-tauri/target/release/bundle/`

## Configuration Files

| File | Purpose |
|------|---------|
| `tauri.conf.json` | App config, window settings, CSP |
| `Cargo.toml` | Rust dependencies, features |
| `vite.config.ts` | Vite config, pdf.js handling |
| `tsconfig.json` | TypeScript configuration |

## Troubleshooting

### "WebView not found" on Linux
```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev
```

### TTS not working on Linux
```bash
sudo apt install speech-dispatcher libspeechd-dev
spd-say "test"  # Verify speech-dispatcher works
```

### PDF.js worker errors
Ensure Vite config excludes pdf.js from optimization:
```typescript
// vite.config.ts
optimizeDeps: {
  exclude: ['pdfjs-dist']
}
```

### Database locked
Check for multiple app instances. SQLite WAL mode handles most concurrency, but only one write connection is allowed.

## Resources

- [Tauri 2.x Documentation](https://v2.tauri.app/)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Rust TTS Crate](https://crates.io/crates/tts)

## Related Specs

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Research Notes](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/)
