# Acceptance checklist — App-root reading-home reachability

- [x] Public `App` root is rendered; the test does not mount ReaderView directly.
- [x] Library and Continue reading are queried by accessible roles/names.
- [x] Page 213/585 and the 36% progress control are asserted.
- [x] Resume uses the rendered book control and reaches the production store.
- [x] Exact library-list IPC arguments are asserted.
- [x] Empty-App mutation makes the reachability assertion red.
- [x] Serial suite DOM cleanup is explicit.
- [x] App fixture locally restores its IPC mock implementation after each test.
- [x] A deterministic same-lifecycle regression inspects the real shared mock.
- [x] Coverage measurement is isolated, reproducible, and ratcheted upward.
- [ ] Product and independent-family review are saved before push/merge.
