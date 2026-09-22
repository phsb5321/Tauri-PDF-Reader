# GitHub identity — verification and handoff

Verified on **21/09/2026**, desktop, by the vision-capable OpenAI seat.
Scope: docs/assets only; no `src/`, icon module, native app icons, UI tokens,
workflows or repository/account settings changed. Generator family: OpenAI.

## Acceptance and visual inspection

The seat opened **every PNG below as an image**, not just its dimensions or code.

| Render inspected                                                               | Observation                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Social master](../../../.github/assets/lectrice-social-preview.png), 1280×640 | Vermilion trace upright and complete; voice begins inside the open beak and exits the right edge. Real ink Fraunces, clear tagline, no texture/model text.                                    |
| [Half-size social](social-640.png), 640×320                                    | Wordmark and tagline remain readable; category is secondary but legible, no clipping.                                                                                                         |
| [Avatar master](../../../.github/assets/lectrice-avatar.png), 460×460          | Existing trace preserved; a single vermilion ring, paper background, generous circle-safe inset.                                                                                              |
| [Native avatar](avatar-64.png), **64×64**                                      | Inspected at its actual 64px size. Singing beak gap, body, tapered tail and ring remain distinct. Feet/perch are fine secondary detail; the eye is not relied on for recognition. Not a blob. |
| [Native circle](avatar-circle-64.png), **64×64**                               | Circle crop preserves the ring and silhouette. This is the actual upload PNG downsampled, not an SVG rendered large and displayed small.                                                      |
| [Pixel zoom](avatar-64-nearest.png), 256×256                                   | Nearest-neighbour 4× view shows the actual small raster; no invented detail. The beak gap remains open; feet are low-detail.                                                                  |
| [Full circle](avatar-circle-460.png), 460×460                                  | No bird/ring content is clipped by the circular boundary.                                                                                                                                     |
| [Contact sheet](proof.png), 1120×750                                           | Native 64px square/circle views and an ink surround also inspected. The paper disc stays intentional on dark backgrounds.                                                                     |

**Optical decision:** retain the detail cut in the seal at 64px. Its bird is
approximately 38×42px, above the brand's ≥32px detail threshold; the silhouette
and beak survive. No new simplified mark is warranted at this size. This is not
a claim that the same seal works at 16px; the existing favicon cut owns ≤24px.
Human audience recall/recognition was not tested; the visual judgment above is
the agent's direct inspection, not a user-study result.

## Executed checks

```text
uv run --with playwright==1.63.0 --with pillow==12.3.0 python docs/brand/render-github.py
PASS: rendered 8 PNGs; {"ink_on_paper": 16.414, "vermilion_on_paper": 4.192}; no browser errors.

uv run --with playwright==1.63.0 --with pillow==12.3.0 python docs/brand/render-github.py --check
PASS: 8 PNGs reproduce pixel-for-pixel; fonts, trace, crop, dimensions, contrast and offline checks passed.

make harness-check
harness-policy: mode=base changed=18 product=0 threshold=3 branch=281-github-identity
harness-policy: PASS
```

The [machine report](render-report.json) binds source/output hashes and browser
version. Chrome's `CSS.getPlatformFontsForNode` confirms **actual custom Fraunces**
for the wordmark and Newsreader for both text lines; this is stronger evidence
than merely asking for a CSS font family. Font axes are asserted, as are the
unchanged bird path and original potrace transform in both SVG compositions.
The social card also has a pixel assertion inside the bird's chest, so a missing
paint cannot pass just because the SVG exists in the DOM.

- Exact upload dimensions: 1280×640 and 460×460; social PNG below 1,000,000 bytes.
- All text bounding boxes remain within a 40px inset; the voice line intentionally bleeds.
- A circular mask removes **zero non-paper pixels**, at 460px and 64px.
- Source-color contrast: ink/paper **16.414:1** (exceeds AAA text threshold);
  vermilion/paper **4.192:1** (exceeds 3:1 non-text threshold, **not** 4.5:1
  normal-text threshold). All text uses ink. These are solid-color ratios, not
  a claim that every antialiased edge pixel individually meets that ratio.
- Browser console/page/request failures fail the run; external requests are blocked.
- Reproduction compares all eight decoded PNG pixel buffers, not only dimensions.

## Failure caught rather than shipped

The first social render used a file-based SVG CSS mask. Chrome blocked it with
a CORS error and the rendered bird was absent. Direct image inspection exposed
this immediately; the run also failed on its console errors. The final HTML
embeds the **verbatim existing trace and transform** instead, and the renderer
uses a short-lived loopback static server (never relaxed browser security).
The painted-chest assertion was added to guard this exact failure mode.

## Handoff / boundaries

- Upload masters and HTML/SVG sources: `.github/assets/`.
- Asset index, exact description/topics, settings instructions: [../README.md](../README.md).
- Durable evidence: this folder; nothing depends on disposable scratch.
- **GitHub preview/avatar/description/topics are NOT applied.** A merge does not
  activate them. The settings owner performs and verifies the documented upload.
- No decorative issue/PR template headers: the bird is identity, not form chrome.
- No product feature or release-readiness claim: the packaged-app user gate is
  outside this docs/assets-only slice. No app test gate is reported as passed.
- Orchestrator review precedes merge. This record proves the assets, not a merge
  or approval; the PR's live state is the authority for those.
