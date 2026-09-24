# Brief — \<flow name\> (Hi-Fi Design Slice)

> Copy this file to `docs/design/flows/<flow>/brief.md` and fill every section **from the code**
> (`rg -n` the components, states, and copy; cite `file:line`). A brief with an unfilled section is
> not a brief — it is a TODO wearing one.
>
> Adapted from DeliCasa's per-flow brief shape (`design/partner/restock-flow/brief.md`) for a desktop
> app: the "surface" is a component tree and its real context, not a URL and not a canvas.

## Surface

<!-- Desktop-app adaptation of DeliCasa's URL + device. Name all four: -->

- **Screen / route:** the component tree that mounts and the condition that mounts it
  (e.g. `ReaderView.tsx` view-swap state), with the actual file paths.
- **Window:** 1200×800 default / 640×600 minimum (`src-tauri/tauri.conf.json` app.windows). State any
  narrower constraint that applies (docked panel, modal).
- **Reader context:** what the reader is doing on this surface, hands on keyboard or mouse, and the
  ambient state (idle / speaking) that changes what the surface must show.
- **States to cover:** enumerated from the code — loading / error / empty / populated / speaking as
  they actually exist in the components. Not imagined ones.

## Source spec

<!-- Lineage: the app spec(s)/story this surface serves + the brand spec. A brief with no parent is
     a red flag — say which spec's acceptance criteria this design feeds. -->

- `specs/NNN-slug/` — …
- `docs/brand/brand-spec.md` — palette, type, geometry, icon rules, principles.

## Required deliverables

<!-- Numbered and named, DeliCasa-style. Exactly two variants — a sheet of eight is how rounds get
     burned; two named directions force a decision. -->

1. `index.html` — hi-fi mock covering the states listed under Surface, rendered at **1200×800** and
   **640×600**, using the real tokens (Catppuccin values, Space Grotesk / IBM Plex faces) so the mock
   and the app cannot drift apart.
2. `variants/` — **exactly two** directions, each _named_ and justified by how the surface is actually
   used (posture, distance, input modality):
   - **Direction A**: \<name\> — \<real-use justification\>.
   - **Direction B**: \<name\> — \<real-use justification\>.
3. `review.md` — the 5-dimension critique **written against the render** at both sizes
   (`docs/design/README.md` — the rule). A text-only seat hands this to a vision-capable seat.

## Constraints

<!-- Numbers and a copy pair. Numbers stop taste arguments; the copy pair stops invented tone. -->

- **Numbers:** hit areas ≥ 24×24px on the 24px icon grid; interactive glyphs render at 16–20px;
  body text ≥ 14px (16px base); text contrast ≥ 4.5:1; radii 0/4/8px (cap); spacing from the
  `--space-*` scale; focus visible for every keyboard-reachable control.
- **Copy pair (this surface):**
  > ✅ "\<the approved sentence — concrete, verb-forward, honest about limits\>"
  > ❌ "\<the rejected sentence — marketing tone, vague, or dishonest about what the app does\>"
- **Brand rules (carried, non-negotiable — `docs/brand/brand-spec.md`):**
  - The mark is **vermilion `#C8462C` on paper `#F4EFE4`**; ink is for type. In the UI, **blue is the
    app, mauve is the voice** (`--color-accent` / `--color-speak`); the spoken-sentence highlight is
    `--color-tts-highlight` (speak @ 16%).
  - **The bird goes where the meaning is:** branded (bird-carried) icons only for voice, reading,
    rest, direction (`src/ui/icons/lectrice-icons.tsx` pairs); chrome stays general/neutral.
  - **Two-cut rule:** detail mark ≥ 32px, favicon cut ≤ 24px; the open beak is the invariant.
  - Tokens only — no raw hex in components, no gradients/glass/neon, no emoji icons, ease-out only,
    no bounce.

## Real content

<!-- From the code, never invented: actual strings, actual state names, actual data shapes. -->

- …

## Output location

```text
docs/design/flows/<flow>/
├── brief.md
├── index.html
├── variants/
│   ├── direction-a.html
│   └── direction-b.html
└── review.md
```

## Out of scope

<!-- Name what this slice deliberately does not touch, so "done" stays bounded. -->

- …
