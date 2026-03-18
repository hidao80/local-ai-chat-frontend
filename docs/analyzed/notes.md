---
name: analyzed-notes
description: Supplementary implementation notes, observations, and repository-specific context.
type: analysis
---

# Notes & Remarks

## i18n Key Count Discrepancy

The `src/locales/en.json` and `src/locales/ja.json` files both contain **32 translation keys** (not 34 as previously stated in overview.md — corrected). The `provider` key has no Japanese translation and remains "Provider" in the Japanese locale.

## Empty Legacy Files

- `src/utils/maked.js` — 0 bytes. Listed in `known_bugs.md` as an unused dependency. `ChatAndSettings.tsx` imports `marked` directly.
- `src/App.css` — 0 bytes. Tailwind CSS handles all styling.

## tsconfig.app.json includes tailwind.config.js

The `tsconfig.app.json` `include` array covers both `src` and `tailwind.config.js`, meaning Tailwind's config is type-checked by the TypeScript compiler.

## docs/spec/ directory

Commit `6d650e9` added `docs/spec/` with 8 markdown files mirroring the content in `docs/analyzed/`. These spec files were the initial drafts; `docs/analyzed/` is the authoritative updated copy.

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
