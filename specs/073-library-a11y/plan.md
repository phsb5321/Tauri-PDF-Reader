# Plan

## Design

Keep the existing Catppuccin palette and introduce three explicit layers:

1. raw `--ctp-*` palette values;
2. semantic `--color-*` roles for surfaces, foregrounds, fills, and chrome;
3. a compatibility layer for the legacy names already used throughout the app.

Foreground roles are distinct from fill roles. Light-theme foregrounds are
derived toward Catppuccin text with `color-mix()` until they clear AA on the
darkest surface where they may appear. Mocha foregrounds retain the palette's
lighter accent values. The light subtle surface uses crust; dark uses surface0
to preserve visible elevation without sacrificing contrast.

## Verification design

A dependency-free Vitest contract parses nested CSS rules with their at-rule
ancestry and resolves document-root declarations through selector specificity
and source order. It resolves `var()` and opaque `color-mix(in srgb, ...)`
chains, then computes WCAG relative luminance for light, system-dark,
explicit-dark, combined OS/explicit preferences, and their increased-contrast
maps. Separate assertions reject non-global definitions masquerading as global
tokens, undefined references, fill tokens in `color:`, and literal font sizes
below the 12px floor.

## Architecture and platform impact

This is UI-token and CSS-only work. It adds no React dependency, IPC call, Tauri
permission, filesystem scope, backend behavior, telemetry, or network path.
