# 251 — qualify library-derived data from candidate 248

## User Scenarios & Testing

A reader changing library sort sees the complete loaded library reordered without a second fetch or loading flicker. Search, selection, shelf membership/counts, and explicit refresh or document mutations retain their existing behavior. Unrelated UI state changes reuse derived results rather than sorting again.

### Acceptance

- Initial load calls the library adapter once; changing each sort order does not call it again. Use discriminating synthetic orderings.
- Search remains title/path case-insensitive and trimmed; sorting preserves existing null fallbacks, stable ties and input immutability.
- Derived identity is stable when selection/view state changes, and invalidates for documents/query/order changes. Rename/remove/relocate/heal/refresh expose current data.
- Shelf membership and full-library counts remain independent of search result count. Selection remains valid.
- Actual library controls are tested; synthetic units do not certify packaged behavior. Packaged sort/search/select journey is required for feature completion.

## Boundary

Only candidate 248's two owned product-file hunks and its synthetic test are eligible for this first integration. Do not import inherited reader/Settings overlays, change audio or navigation, edit other worktrees, retrieve private application data, or activate the app. Existing 245/246/247 remain separate queued candidates with budgets 0/2, 0/2, 1/2 respectively; 248 retains 0/2 until an actual measured correction.
