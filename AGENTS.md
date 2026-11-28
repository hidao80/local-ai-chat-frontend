# AGENTS.md

This file provides guidance to AI coding agents (Codex, Claude Code, etc.) working in this repository.

## Project overview

`local-ai-chat-frontend` is a privacy-first, browser-only chat UI for local/remote LLM endpoints (OpenAI, Ollama, GPT4ALL, LM Studio, llama.cpp). There is no backend: configuration, chat history, and system prompts persist to IndexedDB in the browser, and an API key is sent only to the endpoint of the provider it belongs to (see `.claude/rules/security.md`).

## Key files

- `src/App.tsx`: Root component. Owns global state (config, dark mode, i18n, per-model system prompts) and persists it to the `ai-chat-config` IndexedDB store. Until the startup load has finished (`configLoaded`), Settings is not rendered and the nav buttons that save the config are disabled (Quint findings S4, S8); if that load times out, they stay disabled and App asks the user to reload (S9). `<Chat>` stays mounted in a `hidden` wrapper while Settings is shown, so a pending reply keeps its state (Quint finding F2); Settings is unmounted. Renders the `sonner` `<Toaster>` (bottom-right); IndexedDB failures (config and chat history) go through `notifyStorageError` (`src/lib/notifyStorageError.ts`), which shows `toast.error` with an i18n hint.
- `src/components/`: One file per component — `Settings.tsx` (provider/endpoint/API key/model form, model-list fetch), `Chat.tsx` (message list and the send/stream loop; a reply is bound to the session it was asked in and saved there even if the user switches away, but never into a session the user deleted meanwhile (Quint finding F1); loading a session shows the messages this view last saved for it if they are newer than the stored snapshot (F3); deleting the shown session opens a new chat only if it is still shown when the delete completes (F4); a session already being deleted is not deleted again (F6)), `ChatSidebar.tsx`, `ConfirmModal.tsx`, `Minimap.tsx`.
- `src/lib/`: Non-UI helpers, with colocated Vitest `*.test.ts` — `apiConfig.ts` (`ApiConfig` type), `chatApi.ts` (`buildChatRequest` / `readChatResponse`: request per provider, SSE / NDJSON / JSON reply parsing, tokens/s from completion tokens over generation time), `chatStorage.ts` (`chat-history` IndexedDB CRUD), `configStorage.ts` (`ai-chat-config` IndexedDB save/load; `forgetStoredApiKeys` drops stored keys when "save API keys" is turned off), `markdown.ts` (`renderMarkdown`: `marked` + `DOMPurify`), `idb.ts` (`openDatabase`/`runInStore`: shared IndexedDB open + single-request transaction with error/abort handling; requests to one database run one at a time in call order, so an older write never lands after a newer one; a request that does not finish within 5 s is aborted without effect and rejects with a `TimeoutError` DOMException, so the queue moves on), `lmstudio.ts` (per-model reasoning support — effort / toggle / fixed — from LM Studio native `GET /api/v1/models` `capabilities.reasoning.allowed_options`; falls back to name heuristics when unavailable), `reasoning.ts` (`reasoning_effort` request params: effort level, or `"none"`/`"medium"` to switch a toggle model off/on — `"on"` is rejected by LM Studio), `model.ts` (`isReasoningModel`), `notifyStorageError.ts` (error toast), `storageError.ts` (IndexedDB error name → `storageError*` i18n key).
- `src/i18n.ts`: i18next initialization. Loads `src/locales/en.json` and `src/locales/ja.json`; auto-detects browser language, falls back to English.
- `vite.config.ts`: Vite config. Dev-only proxy `/api/gpt4all` → `http://localhost:4891` (GPT4ALL has no CORS support of its own).
- `index.html`: Vite entry point with OGP/Twitter Card/JSON-LD.
- `tests/e2e/`: Playwright. `screenshot.spec.ts` runs in the mobile/tablet/fhd projects; `production.spec.ts` runs in the `production` project against a fresh build served by `bin/start.js` (port 4174); the other specs (`reasoning`, `chat`, `chat-flow`, `api-key`, `security-settings`, `storage-error`) run in the `functional` project (1280x800, `en-US`) and drive the GUI against an LM Studio mock (`support/app.ts` → `page.route` on `http://localhost:1234`), so no real LLM server is needed. Each fixed Quint finding has a regression test named with its id (e.g. F2, S6); `support/app.ts` has `installIdbGate` helpers to hold IndexedDB completions and `reloadWithIdbOpenHung` to make them time out, `support/findings.ts` helpers shared by those tests.
- `docs/`: GitHub Pages site — independent from the Vite app (no build step). Landing page (`index.html`, `style.css`, `main.js`, `favicon.png`, `social-preview.png`, `llms.txt`) plus project docs (`ADR.md`, `DESIGN.md`).
- `bin/start.js`: Tracked in git. `npx` entry point (recommended over `bunx` — see README); builds `dist/` on first run if missing (runs the `vite` package's bin with `process.execPath`, no shell), then serves it with a small Node HTTP server (`sirv`, SPA fallback) that adds the security headers from `bin/security-headers.json` to every response.
- `bin/security-headers.json` / `docker/nginx.conf`: Response security headers for `bin/start.js` and the Docker (nginx) image.
- `specs/quint/`: Quint models — `chat.qnt` (chat session concurrency: `Chat.tsx` send/stream/switch/delete, `<Chat>` remount via Settings, IndexedDB saves) and `settings.qnt` (Settings form and config persistence: provider/endpoint commit/API key/`sendApiKey`/`saveApiKeys`, the model-list fetch, `configStorage` load/save), each with a `*_test.qnt` of deterministic scenarios; `README.md` has the source correspondence, assumptions and known-violated invariants.

## Commands

- `mise install` — install the toolchain pinned in `mise.toml` (Node.js 26 LTS, Bun; also used by CI's `.github/actions/setup` and the Docker builder stage)
- `bun install` — install dependencies
- `bun run dev` — start dev server (Vite, http://localhost:5173)
- `bun run build` — type-check (`tsc -b`) + build to `dist/`
- `bunx tsc -b` — type-check only (the root `tsconfig.json` only holds project references, so `tsc --noEmit` checks nothing)
- `bun run lint` / `bun run format` — Biome lint / format
- `bun run preview` — serve built `dist/`
- `bun run start` — serve `dist/` via `bin/start.js` (production mode, security headers)
- `bun run test` / `test:run` / `test:coverage` — Vitest unit tests (`src/**/*.test.ts`, jsdom + fake-indexeddb)
- `bun run test:e2e` / `test:e2e:ui` / `test:e2e:headed` / `screenshot` — Playwright E2E tests; `bun run test:gui` — GUI functional tests only. First time: `bunx playwright install chromium`
- `bun run quint:typecheck` / `quint:test` / `quint:run` — Quint spec in `specs/quint/`: type-check, deterministic scenarios, random simulation of the invariants expected to hold plus witnesses (sampled `quint run`). `bun run quint:run:unordered` checks every invariant with IndexedDB completions in any order. CI runs all four in the `quint` job of `test.yml` when `specs/quint/`, dependencies or CI files change
- `docker compose up` / `podman compose up` — containerized dev
- `bunx knip@6.38.0` — unused files, exports, types and dependencies (see `.claude/rules/code-health.md`)
- `bunx jscpd@5.3.2 src tests bin --reporters console` — duplicated code, using `.jscpd.json` (see `.claude/rules/code-health.md`)

## Rules

Rules live in `.claude/rules/` (one topic per file; Claude Code loads them automatically, other agents should read the relevant file before editing):

- `toolchain.md` — bun only, `mise.toml` sync, `bun run build` must pass
- `code-style.md` — English comments, Biome, TypeScript strict, module boundaries
- `ui.md` — React components, i18n, routing, Tailwind
- `code-health.md` — knip / jscpd checks
- `quint.md` — keeping `specs/quint/` and its regression tests in step with the code
- `security.md` — persistence, API keys, endpoint, rendering of LLM output, CORS
- `security-server.md` — `bin/start.js`, security headers, GitHub Actions pinning

## Subagents

Use the following sub-agents in parallel, if available. They are user-level definitions (`~/.claude/agents/`), not tracked in this repository.

- **Code Review:** `code-reviewer`
- **TypeScript Review:** `typescript-reviewer`
- **Security Review:** `security-reviewer`
- **Test:** `code-tester`
