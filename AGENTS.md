# AGENTS.md

This file provides guidance to AI coding agents (Codex, Claude Code, etc.) working in this repository.

## Project overview

`local-ai-chat-frontend` is a privacy-first, browser-only chat UI for local/remote LLM endpoints (OpenAI, Ollama, GPT4ALL, LM Studio, llama.cpp). There is no backend: configuration, chat history, and system prompts persist to IndexedDB in the browser, and an API key is sent only to the endpoint of the provider it belongs to (see Security).

## Key files

- `src/App.tsx`: Root component. Owns global state (config, dark mode, i18n, per-model system prompts) and persists it to the `ai-chat-config` IndexedDB store. Renders the `sonner` `<Toaster>` (bottom-right); IndexedDB failures (config and chat history) go through `notifyStorageError` (`src/lib/notifyStorageError.ts`), which shows `toast.error` with an i18n hint.
- `src/components/`: One file per component — `Settings.tsx` (provider/endpoint/API key/model form, model-list fetch), `Chat.tsx` (message list and the send/stream loop; a reply is bound to the session it was asked in and saved there even if the user switches away), `ChatSidebar.tsx`, `ConfirmModal.tsx`, `Minimap.tsx`. Keep request building and response parsing in `src/lib/chatApi.ts`, not in components.
- `src/lib/`: Non-UI helpers (must not import from `src/components/`), with colocated Vitest `*.test.ts` — `apiConfig.ts` (`ApiConfig` type), `chatApi.ts` (`buildChatRequest` / `readChatResponse`: request per provider, SSE / NDJSON / JSON reply parsing, tokens/s from completion tokens over generation time), `chatStorage.ts` (`chat-history` IndexedDB CRUD), `configStorage.ts` (`ai-chat-config` IndexedDB save/load), `markdown.ts` (`renderMarkdown`: `marked` + `DOMPurify`), `idb.ts` (`openDatabase`/`runInStore`: shared IndexedDB open + single-request transaction with error/abort handling), `lmstudio.ts` (per-model reasoning support — effort / toggle / fixed — from LM Studio native `GET /api/v1/models` `capabilities.reasoning.allowed_options`; falls back to name heuristics when unavailable), `reasoning.ts` (`reasoning_effort` request params: effort level, or `"none"`/`"medium"` to switch a toggle model off/on — `"on"` is rejected by LM Studio), `model.ts` (`isReasoningModel`), `notifyStorageError.ts` (error toast), `storageError.ts` (IndexedDB error name → `storageError*` i18n key).
- `src/i18n.ts`: i18next initialization. Loads `src/locales/en.json` and `src/locales/ja.json`; auto-detects browser language, falls back to English.
- `vite.config.ts`: Vite config. Dev-only proxy `/api/gpt4all` → `http://localhost:4891` (GPT4ALL has no CORS support of its own).
- `index.html`: Vite entry point — already has OGP/Twitter Card/JSON-LD, keep them in sync with `package.json`/README when the project name or description changes.
- `tests/e2e/`: Playwright. `screenshot.spec.ts` runs in the mobile/tablet/fhd projects; `production.spec.ts` runs in the `production` project against a fresh build served by `bin/start.js` (port 4174); the other specs (`reasoning`, `chat`, `chat-flow`, `api-key`, `security-settings`, `storage-error`) run in the `functional` project (1280x800, `en-US`) and drive the GUI against an LM Studio mock (`support/app.ts` → `page.route` on `http://localhost:1234`), so no real LLM server is needed.
- `docs/`: Static GitHub Pages landing page (`index.html`, `style.css`, `main.js`/`main.min.js`, `favicon.png`) — independent from the Vite app, edit directly (no build step).
- `bin/start.js`: Tracked in git. `npx` entry point (recommended over `bunx` — see README); builds `dist/` on first run if missing (runs the `vite` package's bin with `process.execPath`, no shell), then serves it with a small Node HTTP server (`sirv`, SPA fallback) that adds the security headers from `bin/security-headers.json` to every response.
- `bin/security-headers.json` / `nginx.conf`: Response security headers for `bin/start.js` and the Docker (nginx) image. Keep the values identical.

## Commands

- `bun install` — install dependencies
- `bun run dev` — start dev server (Vite, http://localhost:5173)
- `bun run build` — type-check (`tsc -b`) + build to `dist/`
- `bunx tsc -b` — type-check only (the root `tsconfig.json` only holds project references, so `tsc --noEmit` checks nothing)
- `bun run lint` / `bun run format` — Biome lint / format
- `bun run preview` — serve built `dist/`
- `bun run start` — serve `dist/` via `bin/start.js` (production mode, security headers)
- `bun run test` / `test:run` / `test:coverage` — Vitest unit tests (`src/**/*.test.ts`, jsdom + fake-indexeddb)
- `bun run test:e2e` / `test:e2e:ui` / `test:e2e:headed` / `screenshot` — Playwright E2E tests; `bun run test:gui` — GUI functional tests only. First time: `bunx playwright install chromium`
- `docker compose up` / `podman compose up` — containerized dev
- `bunx knip@6.38.0` — unused files, exports, types and dependencies (see "Code health checks")
- `bunx jscpd@5.3.2 src tests bin --reporters console` — duplicated code, using `.jscpd.json` (see "Code health checks")
- After any code change, confirm `bun run build` exits 0.

This project uses **bun** as its package manager (`packageManager` field in `package.json`, `bun.lock`). Do not introduce npm/yarn/pnpm commands or lockfiles.

## Code style

- **Write every code comment in English** — source, tests, JSDoc, and comments in config files (`vite.config.ts`, `playwright.config.ts`, `nginx.conf`, `Dockerfile`, workflows, `index.html`, `bin/`). This applies to new and edited comments alike. User-visible text is not a comment: it goes through i18n (see below).
- Formatter/linter: **Biome** (`biome.json`), not ESLint/Prettier. 2-space indent, double quotes, imports auto-organized — don't hand-reorder them.
- TypeScript strict mode is on (`tsconfig.app.json`): `noUnusedLocals`, `noUnusedParameters`, etc. Eliminate unused code rather than prefixing with `_`.
- React: functional components only. Define prop types inline as object literals (not separate `interface Props`), matching existing components.
- All user-visible text goes through `useTranslation()` — add new keys to **both** `src/locales/en.json` and `src/locales/ja.json`. Call `t("key")` directly — do not add `|| "fallback"` literals.
- `App.tsx` is the sole router; the `showSettings` boolean is the only navigation mechanism — do not introduce a router library.
- Tailwind CSS 4, dark mode via `.dark` class on `<html>` (`dark:` variants, not media queries). `--nav-h` CSS custom property holds nav height for layout calculations.

## Code health checks

Run **knip** (unused code and dependencies) and **jscpd** (duplicated code) after refactoring, adding or removing dependencies, or finishing a feature, and before reporting the work as done.

- `bunx knip@6.38.0` reports unused files, exports, types and dependencies, plus binaries used but not listed in `package.json`.
  - Remove what your change made unused (imports, exports, files, dependencies). Before deleting anything knip reports, confirm with a search that it is really unused.
  - `knip.json` excludes `docs/**` (the GitHub Pages site is independent of the Vite app) and the `act` binary (a separately installed tool used by the `act*` scripts), so a clean run reports nothing and exits 0. Extend those ignores only for code that is used outside knip's view, never to hide real dead code.
  - For pre-existing findings outside your change, report them instead of deleting them.
- `bunx jscpd@5.3.2 src tests bin --reporters console` finds duplicated code with the settings in `.jscpd.json` (`threshold: 0`, so any clone makes it exit 1). Without `--reporters console` it also writes an HTML report to `report/` (git-ignored).
  - Do not add new duplication: extract shared logic into `src/lib/` (app code) or `tests/e2e/support/` (E2E helpers) instead of copying it.
  - Pre-existing clones are not a reason to refactor unrelated code; mention them.
- Both tools run through `bunx` with pinned versions (no `package.json` entry); bump the versions deliberately, as with GitHub Actions.

## Security

- All persistence is IndexedDB only (`ai-chat-config` / `chat-history` DBs). No backend, no `localStorage`/`sessionStorage`.
- API keys: never log them, put them in error messages, or expose them in the DOM. The `Authorization` header is added only when `getAuthKey(config)` is non-empty — keep that conditional, don't send it unconditionally.
- The endpoint input is committed only on blur/Enter (never per keystroke), so partially typed hosts are never requested. API keys are stored per provider (`apiKeys`) with a per-provider send switch (`sendApiKey`); always build the `Authorization` header from `getAuthKey(config)` (`src/lib/apiConfig.ts`), which returns only the selected provider's key and "" when sending is off.
- API keys are stored unencrypted; never describe them as "securely" stored. `saveApiKeys: false` makes `saveConfigToDB` drop `apiKeys` before writing. Settings shows a warning for `http:` endpoints that are not loopback (`isInsecureRemoteEndpoint`).
- `bin/start.js` validates `PORT`/`HOST` before use and never spawns through a shell (it runs the `vite` package's bin with `process.execPath`).
- GitHub Actions are pinned to commit SHAs (`# vX.Y.Z` comment) and Biome to the version in `bun.lock`; bump both deliberately.
- `config.endpoint` is used directly in `fetch` with no sanitization — that's intentional, users point it at their own local/remote LLM servers. Never relay the API key to any URL other than that endpoint.
- LLM responses are rendered with `marked` + `DOMPurify.sanitize(...)` (see `src/lib/markdown.ts`, covered by `markdown.test.ts`) to prevent XSS. If `marked` options change, re-verify that `<script>`/event-handler content in model output still gets stripped.
- Rendering a reply must never make the browser contact another server (data exfiltration via prompt injection). `renderMarkdown` forbids auto-loading/restyling tags and attributes (`style`, `srcset`, media, SVG `image`/`use`/`feImage`, forms, …) and turns every non-`data:image` `<img>` into a click-to-open link; `index.html` adds a CSP meta (`img-src 'self' data:`, `media-src 'none'`, `object-src 'none'`, `form-action 'none'`). Keep both; `connect-src` stays open because users choose their own endpoints.
- Never `eval()` or `new Function()` on LLM response content.
- GPT4ALL CORS is handled only by the Vite dev proxy (`/api/gpt4all`); the production server and nginx image have no proxy. Don't work around CORS with `mode: "no-cors"`, and don't add `Access-Control-Allow-Origin` to the app server — CORS headers on our own responses do not help reach GPT4ALL.
- Security headers (CSP incl. `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP) are defined once in `bin/security-headers.json` and mirrored in `nginx.conf`; `tests/e2e/production.spec.ts` checks both match and that the built app works under the CSP. Change them together. HSTS belongs to whatever terminates TLS.

## Subagents

Use the following sub-agents in parallel, if available.

- **Code Review:** `code-reviewer`
- **Test:** `code-tester`
