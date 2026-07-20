---
name: analyzed-notes
description: Supplementary implementation notes, observations, and repository-specific context not covered elsewhere.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Notes & Remarks

## Table of Contents

- [i18n Key Count](#i18n-key-count)
- [Empty Legacy Files](#empty-legacy-files)
- [tsconfig.app.json Includes tailwind.config.js](#tsconfigappjson-includes-tailwindconfigjs)
- [Documentation Lineage](#documentation-lineage)
- [AGENTS.md / CLAUDE.md Drift](#agentsmd--claudemd-drift)

---

## i18n Key Count

`src/locales/en.json` and `ja.json` both contain **32 translation keys**. The `provider` key has no Japanese translation and remains "Provider" in the Japanese locale. See [[configurations]].

## Empty Legacy Files

- `src/utils/maked.js` — 0 bytes. `ChatAndSettings.tsx` imports `marked` directly. See [[utilities]], [[todo]].
- `src/App.css` — 0 bytes. Tailwind CSS handles all styling. See [[utilities]], [[todo]].

## tsconfig.app.json Includes tailwind.config.js

The `tsconfig.app.json` `include` array covers both `src` and `tailwind.config.js`, meaning Tailwind's config is type-checked by the TypeScript compiler. See [[configurations]].

## Documentation Lineage

Three generations of analysis docs exist in this repo's history:

1. `docs/spec/` (commit `6d650e9`) — initial drafts, later removed.
2. `docs/analyzed/` (commit `76a83b1` "restructure AI agent docs and migrate docs/spec to docs/analyzed") — became the authoritative copy, referenced by `.claude/CLAUDE.md` and `AGENTS.md`.
3. `.claude/analyzed/` (this analysis, commit `1e98095`) — the current authoritative location per the `hidao:code-analyze` skill's fixed output path. `docs/analyzed/` was migrated/consolidated here at the user's explicit direction; see [[todo]] for the cleanup step removing the old directory and repointing `.claude/CLAUDE.md`/`AGENTS.md`.

## AGENTS.md / CLAUDE.md Drift

`AGENTS.md` (Codex-facing) still references `docs/analyzed/*.md` and `.Codex/rules/*.md` paths, mirroring `.claude/CLAUDE.md`'s *pre-migration* state. Since this analysis moves the canonical docs to `.claude/analyzed/`, `AGENTS.md`'s references will go stale unless updated in a follow-up — **Unconfirmed** whether Codex-facing docs are in scope for this Claude-Code-driven migration; flagged rather than changed. See [[todo]].

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
