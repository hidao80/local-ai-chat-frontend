---
name: analyzed-todo
description: Prioritized follow-up work derived from codebase analysis, grouped by category.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# TODO

Not a sprint plan — items surfaced by static analysis, grouped by category, highest-priority category first.

## Table of Contents

- [Security (High Priority)](#security-high-priority)
- [Test](#test)
- [Database](#database)
- [Code Quality](#code-quality)
- [Infrastructure](#infrastructure)
- [Developer Experience](#developer-experience)
- [Performance](#performance)

---

## Security (High Priority)

- [x] **XSS mitigation** — Done: DOMPurify added, sanitizes `marked` output before `dangerouslySetInnerHTML`. See [[security]] M1, [[known_bugs]] #1.
- [ ] **Add a CSP** (★2) — Meta-tag CSP in `index.html` as defense-in-depth against M1. See [[security]] L1.

## Test

- [ ] **Unit tests** — Set up Vitest for `isReasoningModel()` and IndexedDB helpers (currently zero unit test coverage). See [[test]].
- [ ] **E2E: send message** — Mock LLM endpoint in Playwright, test full send/receive flow.
- [ ] **E2E: settings persistence** — Verify config survives page reload.
- [ ] **E2E: session management** — Create, rename, delete sessions.
- [ ] **E2E: dark mode / language toggle**.
- [ ] **Wire E2E + type-check into CI** — Neither `pnpm exec tsc --noEmit`, `pnpm build`, nor `pnpm test:e2e` currently run in any GitHub Actions workflow. See [[development-workflow]].

## Database

- [ ] **Fix `createdAt` overwrite bug** (★3) — Preserve original session creation timestamp across saves. See [[known_bugs]] #7.
- [ ] **Session pagination** — Lazy-load sessions instead of loading all on mount. See [[performance]], [[known_bugs]] #3.

## Code Quality

- [ ] **Remove unused dependencies** — `bootstrap`, `@heroicons/react` (neither imported in `src/`). See [[dependencies]].
- [ ] **Remove `src/utils/maked.js`** — empty legacy file. See [[utilities]], [[notes]].
- [ ] **Remove `src/App.css`** — empty file. See [[utilities]], [[notes]].
- [x] **Reconcile ESLint vs Biome** — Done: ESLint removed entirely, Biome confirmed to cover the same react-hooks checks. See [[configurations]], [[known_bugs]] #10.
- [x] **Pin/update `globals` devDependency** — Done: removed along with ESLint (was an ESLint-only transitive dep). See [[dependencies]], [[known_bugs]] #9.
- [ ] **Custom model entry** — allow typing a model name directly if the model list fetch fails/is incomplete.
- [ ] **Reasoning model opt-in** — allow manual override of `isReasoningModel()` for unrecognized model names. See [[known_bugs]] #5.

## Infrastructure

- [ ] **GPT4ALL production proxy** — document or implement a production-compatible reverse-proxy equivalent (Apache `ProxyPass`, nginx `location`) so GPT4ALL works outside the Vite dev server. See [[known_bugs]] #4, [[infrastructure]].
- [ ] **Fix `.gitignore` `dist/` line** — currently commented out (`# dist/`) despite commit history claiming it was added; confirm intent. See [[known_bugs]] #12.
- [x] **Add missing `LICENSE` file** — Done: MIT LICENSE file added. See [[known_bugs]] #13.
- [ ] **Fix README LM Studio default port** — `12345` in README vs `1234` in code; confirm which is correct. See [[known_bugs]] #11.
- [ ] **Clarify `audit.yml` job 1 purpose** — the `audit` job installs but never audits; rename or merge with `npm-advisory-audit`. See [[infrastructure]].

## Developer Experience

- [ ] **Session export** — export chat history as JSON or Markdown.
- [ ] **Message search** — full-text search across chat sessions.
- [ ] **API request/response examples** — document exact request bodies per provider.
- [ ] **Ollama setup guide** — document `OLLAMA_ORIGINS=*` requirement prominently (partially covered in README, not in-app).
- [ ] **Update `AGENTS.md`** — still points at `docs/analyzed/`; repoint to `.claude/analyzed/` after this migration. See [[notes]].

## Performance

- [ ] **Streaming responses** — SSE/`ReadableStream` incremental display instead of full-response wait. See [[known_bugs]] #2, [[performance]].
- [ ] **Cap Ollama model-detail fetch concurrency** — throttle the `Promise.all` fan-out in `Settings`. See [[known_bugs]] #8, [[performance]].
- [ ] **Multi-modal support** — image input for vision-capable models (feature request, not a defect).

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
