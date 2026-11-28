# Quint specs

- `specs/quint/` (`chat.qnt`, `settings.qnt`) models the code it grounds (`Chat.tsx`, `Settings.tsx`, `App.tsx`, `configStorage.ts`, `chatStorage.ts`, `idb.ts`; see `specs/quint/README.md`). When changing that code, update the spec first and re-run it; never edit the spec to match broken code.
- `quint:run` is a sampled `quint run`; do not use `quint verify` unless model checking is explicitly wanted.
- Each fixed Quint finding has a regression test named with its id (e.g. F2, S6) in `tests/e2e/`.
