# 074 Product review — App-root reading-home reachability

Date: 02/08/2026 00:14 BRT
Reviewer: 🧾 Product & Intent (Sol), read-only
Scope: `spec.md`, `plan.md`, `tasks.md`, `checklist.md`,
`src/__tests__/ui/app-root-reachability.test.tsx`, and the production path it
asserts. No files edited and no test slot consumed.

## Findings

- **BLOCKER:** none.
- **MAJOR:** none.
- **MINOR:** none.

## Evidence

1. **Pedro's outcome is frozen at the correct boundary.** The test renders
   public `<App />`, not `ReaderView` or `LibraryView` directly. It reaches the
   `Library` heading and named `Continue reading` region, locates the rendered
   Moby-Dick control, and asserts visible `Page 213 of 585`.
2. **Progress is accessible and discriminating.** The App-root test requires the
   named `Moby-Dick progress` native progressbar with value 36. The existing
   focused `ContinueReading.test.tsx` separately pins `max="100"`, so removing
   the percentage denominator or changing the value makes the combined
   acceptance suite red.
3. **Resume follows production orchestration.** Activating the public book
   button enters `ReaderView.handleResume` → `useOpenPdf.resumeDocument` →
   `showInReader`. The test verifies the fixture file path passed to the PDF
   service and the production document store lands on document `doc-1`, page 213. It does not seed the store behind the shell.
4. **The backend boundary is honest.** The exact
   `library_list_documents({ orderBy: "last_opened", limit: undefined,
offset: undefined })` call is asserted through mockIPC. Leaf PDF painting,
   toolbar, and playback components are deliberately stubbed and named as
   non-goals.
5. **The falsifier distinguishes the regression.** The recorded empty-App
   mutation fails at the missing Library heading, which is the original
   reachability failure class that component-only tests could not detect.
6. **Coverage work is complete and scoped.** The isolated serial run recorded
   70 files / 890 tests and 68.58 statements/lines, 91.41 branches, 70.65
   functions. Floors move upward to 68/91/70/68; no floor or test is weakened.
7. **Headless/native boundary is not overclaimed.** The spec explicitly excludes
   canvas/text-layer painting, process bootstrap, native clickability,
   close/relaunch persistence, and page 214. The frozen packaged 074 journey
   remains a separate required adoption task under 075; this PASS does not mark
   that native journey green.
8. **Tasks are implementation-ready.** T007 lint/typecheck/diff, T009 saved
   independent-family review, and T010 evidence handoff are concrete remaining
   delivery steps. This review satisfies T008.

## Verdict

**PASS** for the scoped 074 App-root/headless regression and SpecKit artifacts.
This is Product approval, not the independent-family adversarial verdict and
not packaged native evidence.
