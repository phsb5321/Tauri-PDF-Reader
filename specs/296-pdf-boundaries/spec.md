# 296 — Preserve extracted line-end evidence

Readers must retain line and paragraph boundaries when a line-end marker is emitted separately from visible text, without changing source offsets or splitting detached footnotes into false paragraphs.

## User Scenarios & Testing

A reader loading a page whose line breaks arrive as separate empty items gets
usable line/paragraph metadata rather than one flattened narration block.
The automated tests cover carriers between text, at page edges, repeated
carriers, and detached glyphs. Source offset and footnote regressions are gates.

## Acceptance

- Empty/whitespace line-end markers terminate the preceding segment, including repeated and trailing markers. Leading markers do not leak forward.
- Input objects remain unchanged; UTF-16 segment slices match the normalized source.
- The existing page-19 superscript suppression and minimum-run assertions remain unchanged and pass.
- Both the PDF text builder and its annotation consumer share the repair.

## Scope

Extraction metadata only. No new normalization, geometry-only paragraph inference, timing-provider claims, cloud dispatch, or backend changes.
