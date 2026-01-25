# Research: PDF Rendering Quality & Hardware Acceleration

**Feature Branch**: `004-pdf-render-quality`
**Date**: 2026-01-14

## Summary

This document captures research decisions for achieving browser-quality PDF rendering in Tauri with configurable quality modes and platform-specific hardware acceleration options.

---

## R1: PDF.js HiDPI Rendering Approach

### Decision
Use the official PDF.js canvas transform matrix pattern with configurable `outputScale` instead of hardcoded 4x scaling.

### Rationale
- The official approach separates physical canvas dimensions from CSS dimensions
- Transform matrix `[scale, 0, 0, scale, 0, 0]` applies scaling at render time
- Allows dynamic quality adjustment based on available memory

### Implementation Pattern
```typescript
// 1. Calculate scales
const viewport = page.getViewport({ scale: userZoom });
const outputScale = calculateOptimalOutputScale(viewport, maxMegapixels);

// 2. Physical dimensions (render at high-DPI)
canvas.width = Math.floor(viewport.width * outputScale);
canvas.height = Math.floor(viewport.height * outputScale);

// 3. CSS dimensions (display size)
canvas.style.width = `${Math.floor(viewport.width)}px`;
canvas.style.height = `${Math.floor(viewport.height)}px`;

// 4. Transform matrix
const transform = outputScale !== 1
  ? [outputScale, 0, 0, outputScale, 0, 0]
  : undefined;

// 5. Render with optimal context settings
const context = canvas.getContext('2d', {
  alpha: false,           // PDF.js uses opaque background
  desynchronized: true,   // Direct GPU→display path (critical for Tauri)
  willReadFrequently: false,
});
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Fixed 4x scaling | Causes memory exhaustion on large pages at high zoom |
| CSS-only scaling | Results in blurry text, doesn't use full resolution |
| OffscreenCanvas | Browser support varies; complexity without clear benefit |

---

## R2: Quality Mode Scale Factors

### Decision
Three quality modes with the following minimum outputScale multipliers:

| Mode | Min Output Scale | Use Case |
|------|------------------|----------|
| Performance | `max(dpr, 1.5)` | Older hardware, large documents |
| Balanced | `max(dpr, 2.0)` | Default, good quality on modern hardware |
| Ultra | `max(dpr, 3.0)` | Maximum crispness, higher memory usage |

### Rationale
- `devicePixelRatio` is the floor to prevent CSS upscaling blur
- Performance mode uses 1.5x minimum (visually acceptable, 2.25x memory vs 1x)
- Ultra mode caps at 3x (9x memory) rather than 4x (16x) for safety

### Memory Impact
For A4 page (595×842 logical pixels) at 150% zoom:

| Mode | Canvas Size | Memory/Page |
|------|-------------|-------------|
| Performance @1.5x | 1339×1895 | ~10 MB |
| Balanced @2.0x | 1785×2526 | ~18 MB |
| Ultra @3.0x | 2678×3789 | ~40 MB |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Continuous slider | Users don't understand "2.3x" vs "2.5x" |
| More than 3 modes | Paralysis of choice without clear benefit |
| Auto-detect based on GPU | Unreliable detection across platforms |

---

## R3: Megapixel Capping Strategy

### Decision
Default maximum canvas size of 24 megapixels (~96 MB per page), configurable from 8-48 MP.

### Rationale
- 24 MP allows Ultra mode at 150% zoom on most pages
- Below WebKit's 67 MP hard limit (safe for macOS/Linux)
- Leaves headroom for text layer and highlight overlays

### Calculation Formula
```typescript
const megapixels = (canvasWidth * canvasHeight) / 1_000_000;
const memoryMB = megapixels * 4; // 4 bytes per RGBA pixel

// Reduce outputScale if exceeding limit
while (megapixels > maxMegapixels && outputScale > 1) {
  outputScale = getNextLowerScale(outputScale);
  // Recalculate megapixels
}
```

### Platform Limits
| Platform | Browser | Safe Limit | Hard Limit |
|----------|---------|------------|------------|
| Windows | Chromium | 100 MP | 268 MP |
| macOS | WebKit | 50 MP | 67 MP |
| Linux | WebKit | 40 MP | 67 MP |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| No limit (current) | OOM crashes on large pages at high zoom |
| Per-platform limits | User confusion; prefer single configurable value |
| Automatic resize | Jarring visual changes during zoom |

---

## R4: Hardware Acceleration Configuration

### Decision
Expose experimental toggle in settings with platform-specific implementation:
- **Windows**: `additionalBrowserArgs` in `tauri.conf.json`
- **Linux**: Environment variables set before WebView initialization
- **macOS**: Document-only (no user control; Metal is automatic)

### Rationale
- HW acceleration issues (white screen, crashes) are platform-specific
- Recovery must be possible without editing config files
- Settings require app restart to take effect

### Windows (WebView2/Chromium)
```json
{
  "app": {
    "windows": [{
      "additionalBrowserArgs": "--disable-gpu --disable-gpu-compositing"
    }]
  }
}
```

Key flags:
- `--disable-gpu` - Disables GPU entirely
- `--disable-gpu-compositing` - CPU compositing only

### Linux (WebKitGTK)
```rust
// Set BEFORE tauri::Builder::default()
if !hw_accel_enabled {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
}
```

### Recovery Flow
1. User experiences white screen/crash
2. App stores "failed to render" flag on crash
3. Next launch detects flag, shows recovery dialog
4. User can disable HW acceleration
5. App restarts with software rendering

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| No toggle | Users stuck with broken rendering |
| Runtime toggle | Not possible; WebView settings are fixed at creation |
| Auto-disable on failure | Detecting failure is unreliable |

---

## R5: TextLayer Alignment

### Decision
Use PDF.js's `--scale-factor` CSS variable to synchronize text layer with canvas.

### Rationale
- PDF.js TextLayer positions text spans based on this variable
- Must match the viewport scale (NOT the outputScale)
- Misalignment causes selection boxes to not match visible text

### Implementation
```typescript
// --scale-factor = viewport zoom level
textLayerDiv.style.setProperty('--scale-factor', String(zoomLevel));

// TextLayer uses this to scale text positions
// Must be set BEFORE calling textLayer.render()
```

### Relationship to Scales
| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `zoomLevel` | User zoom (CSS scale) | 1.5 |
| `outputScale` | HiDPI multiplier | 3.0 |
| `--scale-factor` | TextLayer CSS | "1.5" |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Manual text positioning | Complex, error-prone, reinvents PDF.js |
| Scaling TextLayer with outputScale | Causes text to be 3x too big |

---

## R6: Render Debouncing

### Decision
Debounce resize/zoom events at 150ms with cancellable render tasks.

### Rationale
- Prevents "render thrash" during continuous resize/zoom
- 150ms feels responsive while reducing wasted renders
- Cancellation avoids multiple in-flight renders

### Implementation Pattern
```typescript
const debouncedRender = useMemo(
  () => debounce((plan: RenderPlan) => {
    // Cancel previous render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }
    // Start new render
    renderTaskRef.current = page.render(plan);
  }, 150),
  []
);
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| No debounce | Render thrash, wasted resources |
| Longer debounce (300ms+) | Feels sluggish |
| requestAnimationFrame | 60fps is too fast for heavy PDF renders |

---

## R7: Debug Overlay Information

### Decision
Display the following metrics in the debug overlay:
- Viewport size (logical pixels)
- Device pixel ratio
- Output scale (actual)
- Canvas dimensions (physical pixels)
- Effective megapixels
- Memory estimate (MB)
- Quality mode
- Megapixel cap applied (yes/no)

### Rationale
- Users can diagnose "why is it blurry?" with concrete numbers
- Developers can verify scaling logic
- Memory estimate helps identify potential issues

### Display Format
```
Viewport: 1200×1600
DPR: 2.0
Output Scale: 3.0x
Canvas: 3600×4800
Megapixels: 17.3 MP
Memory: ~69 MB
Quality: Ultra
Capped: No
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Fewer metrics | Not enough for meaningful debugging |
| Browser DevTools only | Not accessible to end users |
| Verbose logging | Hard to find relevant info |

---

## Dependencies & Sources

### PDF.js
- Official HiDPI documentation: [mozilla.github.io/pdf.js/examples](https://mozilla.github.io/pdf.js/examples/)
- TextLayer CSS: `pdfjs-dist/web/pdf_viewer.css`

### Tauri
- Windows WebView2 args: [tauri-apps/tauri configuration reference](https://v2.tauri.app/reference/config/)
- Linux WebKitGTK issues: [tauri-apps/tauri#9394](https://github.com/tauri-apps/tauri/issues/9394)

### Canvas Limits
- Chromium: 268M pixels (16384×16384)
- WebKit: 67M pixels (8192×8192)
- Memory: 4 bytes per pixel (RGBA)
