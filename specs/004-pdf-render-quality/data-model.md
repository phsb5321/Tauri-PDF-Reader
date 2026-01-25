# Data Model: PDF Rendering Quality & Hardware Acceleration

**Feature Branch**: `004-pdf-render-quality`
**Date**: 2026-01-14

## Entities

### QualityMode (Enum)

Predefined rendering quality profiles.

| Value | Description |
|-------|-------------|
| `performance` | Lower quality, faster rendering, reduced memory |
| `balanced` | Default, good quality on modern hardware |
| `ultra` | Maximum crispness, higher memory usage |

**Constraints**:
- Must be one of the three defined values
- Default: `balanced`

---

### RenderSettings (Value Object)

User-configurable rendering preferences persisted to database.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `qualityMode` | QualityMode | `balanced` | Selected quality profile |
| `maxMegapixels` | number | 24 | Canvas size cap (8-48 range) |
| `hwAccelerationEnabled` | boolean | platform-dependent | GPU acceleration toggle |
| `debugOverlayEnabled` | boolean | false | Show render diagnostics |

**Platform Defaults for hwAccelerationEnabled**:
- Windows: `true`
- macOS: `true`
- Linux: `false` (due to WebKitGTK variability)

**Validation Rules**:
- `maxMegapixels` must be between 8 and 48
- `qualityMode` must be valid enum value

---

### RenderPlan (Calculated, Non-Persisted)

Computed rendering parameters for a specific page render.

| Field | Type | Description |
|-------|------|-------------|
| `zoomLevel` | number | User zoom (1.0 = 100%) |
| `outputScale` | number | HiDPI multiplier (1.0-4.0) |
| `viewportWidth` | number | Logical width (CSS pixels) |
| `viewportHeight` | number | Logical height (CSS pixels) |
| `canvasWidth` | number | Physical width (device pixels) |
| `canvasHeight` | number | Physical height (device pixels) |
| `megapixels` | number | Total megapixels |
| `memoryMB` | number | Estimated memory usage |
| `wasCapped` | boolean | Whether megapixel cap was applied |

**Relationships**:
- Derived from RenderSettings + page dimensions + display info

---

### DisplayInfo (Runtime, Non-Persisted)

Current display characteristics.

| Field | Type | Description |
|-------|------|-------------|
| `devicePixelRatio` | number | Display scaling factor |
| `viewportWidth` | number | Container width |
| `viewportHeight` | number | Container height |

---

## State Transitions

### RenderSettings Lifecycle

```
[User Opens App]
       │
       ▼
[Load Settings from DB] ──────┐
       │                       │
       ▼                       │ (first launch)
[Apply to Render Pipeline]    ▼
       │              [Create Default Settings]
       │                       │
       │◄──────────────────────┘
       │
       ▼
[User Modifies Settings]
       │
       ├─── (qualityMode/maxMegapixels/debugOverlay)
       │              │
       │              ▼
       │       [Save to DB]
       │              │
       │              ▼
       │       [Apply Immediately]
       │
       └─── (hwAccelerationEnabled)
                     │
                     ▼
              [Save to DB]
                     │
                     ▼
              [Show "Restart Required"]
                     │
                     ▼
              [User Restarts App]
                     │
                     ▼
              [Setting Takes Effect]
```

### RenderPlan Calculation

```
[Page + Zoom Change]
       │
       ▼
[Get Current RenderSettings]
       │
       ▼
[Get DisplayInfo]
       │
       ▼
[Calculate Base Output Scale]
  │ (from qualityMode + devicePixelRatio)
       │
       ▼
[Calculate Canvas Dimensions]
       │
       ▼
[Check Megapixel Limit]
       │
       ├─── (under limit)
       │         │
       │         ▼
       │  [wasCapped = false]
       │
       └─── (over limit)
                 │
                 ▼
          [Reduce outputScale]
                 │
                 ▼
          [wasCapped = true]
                 │
       ◄─────────┘
       │
       ▼
[Return RenderPlan]
```

---

## Database Schema

### Settings Table (existing, extended)

```sql
-- Extend existing settings table
-- Settings stored as key-value pairs

INSERT INTO settings (key, value) VALUES
  ('render.qualityMode', '"balanced"'),
  ('render.maxMegapixels', '24'),
  ('render.hwAccelerationEnabled', 'true'),
  ('render.debugOverlayEnabled', 'false');
```

**Note**: Using existing settings pattern (JSON values in SQLite) for consistency with current codebase.

---

## Relationships

```
┌─────────────────────┐
│   RenderSettings    │
│   (persisted)       │
└──────────┬──────────┘
           │
           │ references
           ▼
┌─────────────────────┐
│    QualityMode      │
│    (enum)           │
└─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│   RenderSettings    │     │    DisplayInfo      │
│   (persisted)       │     │    (runtime)        │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └───────────┬───────────────┘
                       │
                       │ inputs to
                       ▼
              ┌─────────────────────┐
              │    RenderPlan       │
              │    (calculated)     │
              └─────────────────────┘
```

---

## Constraints & Invariants

1. **Quality Mode Consistency**: `outputScale` must respect QualityMode minimum
2. **Memory Safety**: Canvas dimensions must not exceed `maxMegapixels * 1,000,000`
3. **Platform HW Defaults**: Linux defaults to `hwAccelerationEnabled: false`
4. **Restart Requirement**: `hwAccelerationEnabled` changes require app restart
5. **Scale Bounds**: `outputScale` must be between 1.0 and 4.0
6. **Zoom Bounds**: `zoomLevel` must be between 0.25 and 4.0 (from existing constants)
