# Tasks 275 — brand icon set (general + branded)

- [x] T275-1 Trace the two new shapes (quill, flying bird) from the generated pair sheet; normalise by
      taking the balanced `<svg>` body (a non-greedy group match truncates nested potrace groups).
- [x] T275-2 Author `src/ui/icons/lectrice-icons.tsx` — 13 icons on a 24px box + `iconPairs`.
- [x] T275-3 Render every icon at 48px and 16px and review the sheet; fix inverted traces.
- [x] T275-4 Wire `AiPlaybackBar`: play → `IconSing`, pause → `IconPause` (relative import — no `@/`
      alias exists in this repo).
- [x] T275-5 `pnpm typecheck` clean; `pnpm lint` 0 errors.
- [x] T275-6 `docs/brand/brand-spec.md`: the general/branded rule.
- [ ] T275-7 CI green on this head, then squash-merge; verify the post-merge tree.

## Follow-ups (deliberately not in this change)

- Replace the remaining ad-hoc inline glyphs in other components, one slice at a time.
- Simplified sub-24px variants of the branded icons — the two-cut logic the mark already uses.
- In-app surfaces still use Catppuccin tokens; carrying the paper/vermilion system into the UI is its
  own slice (touches UI tests).
