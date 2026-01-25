# Quickstart: PDF Rendering Quality & Hardware Acceleration

**Feature Branch**: `004-pdf-render-quality`
**Date**: 2026-01-14

## Overview

This feature improves PDF rendering quality to match browser standards with configurable quality modes, megapixel capping, and optional hardware acceleration control.

## Key Components

### 1. RenderPolicy (Domain Layer)

Central logic for computing render parameters.

**Location**: `src/domain/rendering/RenderPolicy.ts`

```typescript
import { calculateRenderPlan } from '../domain/rendering/RenderPolicy';

const plan = calculateRenderPlan({
  pageWidth: 595,
  pageHeight: 842,
  zoomLevel: 1.5,
  settings: {
    qualityMode: 'balanced',
    maxMegapixels: 24,
  },
  displayInfo: {
    devicePixelRatio: 2,
    viewportWidth: 1200,
    viewportHeight: 800,
  },
});

// plan.outputScale, plan.canvasWidth, plan.canvasHeight, etc.
```

### 2. Quality Mode Selection (UI)

Settings panel component for quality mode.

**Location**: `src/components/settings/RenderSettings.tsx`

```typescript
import { RenderSettings } from '../components/settings/RenderSettings';

// In SettingsPanel
<RenderSettings
  settings={currentSettings}
  onSettingsChange={handleSettingsChange}
/>
```

### 3. Debug Overlay

Real-time render diagnostics.

**Location**: `src/components/settings/DebugOverlay.tsx`

Enable via Settings > Debug > Show Render Overlay

Displays:
- Viewport size
- Device pixel ratio
- Output scale
- Canvas dimensions
- Megapixels
- Memory estimate
- Cap applied (yes/no)

### 4. Hardware Acceleration Toggle

Platform-specific GPU control.

**Location**: Settings > Advanced > Hardware Acceleration

- Windows: Uses `additionalBrowserArgs`
- Linux: Sets `WEBKIT_DISABLE_DMABUF_RENDERER`
- macOS: Metal automatic (no toggle effect)

**Note**: Requires app restart to take effect.

## Usage Flow

### Basic Usage (Default)

1. Open PDF - renders at "Balanced" quality
2. Zoom/resize - RenderPolicy calculates optimal scale
3. If page exceeds 24MP - automatically reduces quality

### Adjusting Quality

1. Open Settings (Ctrl+,)
2. Navigate to "Rendering"
3. Select Quality Mode:
   - **Performance**: Faster, lower memory
   - **Balanced**: Default, good quality
   - **Ultra**: Maximum crispness
4. Changes apply immediately

### Troubleshooting Rendering Issues

1. Enable Debug Overlay (Settings > Debug)
2. Check displayed values:
   - "Capped: Yes" means page hit memory limit
   - Low outputScale may indicate memory pressure
3. Try reducing Quality Mode to "Performance"
4. If issues persist, disable Hardware Acceleration and restart

### Platform-Specific Notes

**Windows**:
- Hardware acceleration enabled by default
- Can be disabled if experiencing GPU issues

**Linux**:
- Hardware acceleration disabled by default
- WebKitGTK DMA-BUF issues common with NVIDIA
- Enable cautiously; may cause white screens

**macOS**:
- Metal rendering automatic
- Toggle has no effect (WebKit controls GPU)

## Testing

### Verify Quality Modes

```bash
# Run visual regression tests
pnpm test:e2e --grep "quality modes"
```

### Verify Megapixel Capping

1. Open large PDF page
2. Zoom to 300%
3. Enable debug overlay
4. Verify "Capped: Yes" appears
5. Text should remain sharp (reduced scale, not pixelated)

### Verify Hardware Acceleration

```bash
# Test on each platform
# 1. Enable HW accel
# 2. Restart app
# 3. Verify rendering works
# 4. Disable HW accel
# 5. Restart app
# 6. Verify rendering works (software fallback)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  RenderSettings.tsx, DebugOverlay.tsx, PdfViewer.tsx        │
├─────────────────────────────────────────────────────────────┤
│                      Hooks Layer                            │
│  useRenderSettings.ts (state + persistence)                 │
├─────────────────────────────────────────────────────────────┤
│                     Domain Layer                            │
│  RenderPolicy.ts (pure logic, no I/O)                       │
├─────────────────────────────────────────────────────────────┤
│                    Store Layer                              │
│  render-store.ts (Zustand state)                            │
├─────────────────────────────────────────────────────────────┤
│                   Adapters Layer                            │
│  Tauri IPC for settings persistence                         │
└─────────────────────────────────────────────────────────────┘
```

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/domain/rendering/RenderPolicy.ts` | NEW | Central render calculation |
| `src/domain/rendering/QualityMode.ts` | NEW | Mode definitions |
| `src/domain/rendering/types.ts` | NEW | Type definitions |
| `src/components/settings/RenderSettings.tsx` | NEW | Quality mode UI |
| `src/components/settings/DebugOverlay.tsx` | NEW | Diagnostics overlay |
| `src/hooks/useRenderSettings.ts` | NEW | Settings hook |
| `src/stores/render-store.ts` | NEW | Render state |
| `src/components/PdfViewer.tsx` | MODIFY | Use RenderPolicy |
| `src/components/pdf-viewer/PdfPage.tsx` | MODIFY | Use RenderPolicy |
| `src/services/pdf-service.ts` | MODIFY | Accept RenderPlan |
| `src-tauri/src/commands/settings.rs` | MODIFY | Add render commands |
| `src-tauri/tauri.conf.json` | MODIFY | HW accel config |
