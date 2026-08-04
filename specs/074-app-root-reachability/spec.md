# Feature 074 — App-root reading-home reachability

## User outcome

As a reader with an in-progress PDF, I open Lectrice to a home page that shows
my reading progress and lets me continue from the page where I stopped.

## Acceptance requirements

- **FR-001:** Rendering the public `App` root with one in-flight document must
  show the Library home by default.
- **FR-002:** The Continue reading region must show the document title,
  `Page 213 of 585`, and a 36% accessible progress control.
- **FR-003:** Activating the rendered document control must load that document's
  file and restore page 213 in the production document store.
- **FR-004:** The test must observe the real `library_list_documents` command
  contract rather than seeding a component or store behind the public shell.
- **FR-005:** Test isolation must remove rendered DOM after every test file so a
  serial full-suite run cannot satisfy or break queries with stale trees.
- **FR-006:** Because this is a test-only coverage gain, the four coverage floors
  must be raised to the measured 074 baseline in the same change.

## Non-goals

- PDF canvas/text-layer painting, process bootstrap, and native WebDriver
  clickability are outside this headless App-root gate.
- EPUB import, nested shelves, bulk healing, within-page scroll restoration,
  and the page-214 persistence journey are separate slices.

## Success criteria

- The targeted App-root test passes through the rendered public control.
- Replacing `App` with an empty root makes the Library assertion fail.
- One isolated serial coverage run passes and reports at least 68% lines and
  statements, 70% functions, and 91% branches.
