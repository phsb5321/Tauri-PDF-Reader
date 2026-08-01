# Superseded reader-vision drafts

Explorations that came before the A/B/C set in the parent directory and did not
become one of them. Kept because they are the only record of a direction that
was tried and dropped, and because a rejected layout is cheaper to re-read than
to re-derive.

Nothing here is a candidate. `direction-choice.md` decides between
`direction-a-signal-desk`, `direction-b-calm-listen` and
`direction-c-editorial-focus` only.

They live in this subdirectory rather than beside their successors because
`render-screenshots.py:334` globs `direction-*.html` in the parent directory and
renders every match. A draft dropped in next to the real ones would be pulled
into that run and judged against acceptance criteria it was never written to
meet.

The glob is non-recursive, so this subdirectory is outside it, and passing the
file explicitly does not reach it either — `main()` treats its arguments as
slugs and resolves `HERE / f"{slug}.html"`, so a path argument becomes
`…/superseded/direction-a-scholars-desk.html.html` and reports missing. Note
also that the script is run by hand: no workflow and no `package.json` script
invokes it, so "would be pulled in" means a local run, not a red check.

## `direction-a-scholars-desk.html`

Dated 30/07/2026, one day before the A/B/C set. Titled "Reader Vision
(Direction A · Scholar's Desk)"; the Direction A that shipped into the choice
set is "Signal Desk", so this is the earlier take on the same slot, not a fourth
option.

It survived only as an untracked file in the main worktree's `_temp/`, which is
why it is being committed now — an artifact reachable from nothing is one
`git clean` away from gone.

One concrete reason it could not have been promoted as-is: it loads Inter and a
serif face from `fonts.googleapis.com` / `fonts.gstatic.com`. The three
candidates are offline by construction, and `render()` asserts that: any request
whose URL is not `file:`, `data:` or `about:` is recorded as a problem, as is any
websocket or worker at all. So this draft fails the network check before anyone
gets to judge how it looks.

"As-is" is doing real work in that sentence and is not a claim that the file is
unfixable: self-hosting the two faces would clear the check. That was never the
reason it lost, though. It lost the slot to Signal Desk on the design, and the
fonts are only why it could not have been dropped in beside the candidates and
compared on equal terms.
