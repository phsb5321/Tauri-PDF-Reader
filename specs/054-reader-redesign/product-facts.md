# Lectrice Reader Redesign · Product Facts

> Captured: 30/07/2026  
> Status: verified from the repository, the running macOS build, and primary sources

## Lectrice

- Lectrice is a local-first desktop PDF reader with highlighting and text-to-speech.
- Its primary journey is: open a local PDF → read or highlight the page → listen with synchronized word highlighting → continue across pages.
- The shipped brand promise is **“Every page, read aloud.”**
- The shipped mark is three nested angular chevrons representing voice channels.
- The shipped color rule is **blue = the app; mauve = the active voice**.
- The current production shell is `ReaderView` → `AppLayout` with `Toolbar`, `PdfViewer`, and a conditional `AiPlaybackBar`.
- The current empty state and active-reader chrome were inspected from `origin/main` at `d8ff4296f7d0094cefdc1e46349ab74c02669a4b`.
- A running macOS development build was captured at
  `research/current-empty-state.png`.

## External interaction references

- Apple named Speechify the 2025 Apple Design Award winner for Inclusivity. Apple
  specifically praised its approachable interface, accessibility support, and
  reduction of cognitive load across document/PDF listening.
  Source: <https://developer.apple.com/design/awards/2025/>
- Apple named iA Writer a 2025 Apple Design Award Interaction finalist and highlighted
  its distraction-free focus, selective text highlighting, and gestures that reveal
  the library and document preview without permanently crowding the writing surface.
  Source: <https://developer.apple.com/design/awards/2025/>
- LiquidText describes its document workspace as an award-winning PDF and universal
  document reader centered on reading, extracting, and organizing source material.
  Source: <https://www.liquidtext.net/>

These are interaction and hierarchy references, not visual skins to copy. Lectrice
keeps its own mark, Catppuccin-derived palette, local-first posture, and TTS-first
identity.

