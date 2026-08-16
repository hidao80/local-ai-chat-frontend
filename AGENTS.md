# AGENTS.md

This file provides guidance to AI coding agents (Codex, Claude Code, etc.) working in this repository.

## Project overview

`local-ai-chat-frontend` is a privacy-first, browser-only chat UI for local/remote LLM endpoints (OpenAI, Ollama, GPT4ALL, LM Studio, llama.cpp). There is no backend: all configuration, chat history, and system prompts persist to IndexedDB in the browser, and API keys never leave the device.

## Key files

- `src/App.tsx`: Root component. Owns global state (config, dark mode, i18n, per-model system prompts) and persists it to the `ai-chat-config` IndexedDB store.
- `src/components/ChatAndSettings.tsx`: All UI logic — exports `Settings` and `Chat`. Handles LLM API calls, chat session history (`chat-history` IndexedDB store), the minimap, and per-model system prompts. Keep both components in this one file unless it exceeds maintainability limits.
- `src/i18n.ts`: i18next initialization. Loads `src/locales/en.json` and `src/locales/ja.json`; auto-detects browser language, falls back to English.
- `vite.config.ts`: Vite config. Dev-only proxy `/api/gpt4all` → `http://localhost:4891` (GPT4ALL has no CORS support of its own).
- `index.html`: Vite entry point — already has OGP/Twitter Card/JSON-LD, keep them in sync with `package.json`/README when the project name or description changes.
- `tests/e2e/screenshot.spec.ts`: Playwright E2E test (mobile/tablet/fhd viewports).
- `docs/`: Static GitHub Pages landing page (`index.html`, `style.css`, `main.js`/`main.min.js`, `favicon.png`) — independent from the Vite app, edit directly (no build step).
- `bin/start.js`: Tracked in git. `npx`/`bunx` entry point; builds `dist/` on first run if missing (`npx vite build`), then starts `sirv-cli --cors` to serve it.

## Commands

- `bun install` — install dependencies
- `bun run dev` — start dev server (Vite, http://localhost:5173)
- `bun run build` — type-check (`tsc -b`) + build to `dist/`
- `bunx tsc --noEmit` — type-check only
- `bun run lint` / `bun run format` — Biome lint / format
- `bun run preview` — serve built `dist/`
- `bun run start` — serve `dist/` via sirv-cli (production mode)
- `bun run test:e2e` / `test:e2e:ui` / `test:e2e:headed` / `screenshot` — Playwright E2E tests
- `docker compose up` / `podman compose up` — containerized dev
- After any code change, confirm `bun run build` exits 0.

This project uses **bun** as its package manager (`packageManager` field in `package.json`, `bun.lock`). Do not introduce npm/yarn/pnpm commands or lockfiles.

## Code style

- Formatter/linter: **Biome** (`biome.json`), not ESLint/Prettier. 2-space indent, double quotes, imports auto-organized — don't hand-reorder them.
- TypeScript strict mode is on (`tsconfig.app.json`): `noUnusedLocals`, `noUnusedParameters`, etc. Eliminate unused code rather than prefixing with `_`.
- React: functional components only. Define prop types inline as object literals (not separate `interface Props`), matching existing components.
- All user-visible text goes through `useTranslation()` — add new keys to **both** `src/locales/en.json` and `src/locales/ja.json`. The `t("key") || "fallback"` pattern exists in legacy code; prefer proper i18n keys for new strings.
- `App.tsx` is the sole router; the `showSettings` boolean is the only navigation mechanism — do not introduce a router library.
- Tailwind CSS 4, dark mode via `.dark` class on `<html>` (`dark:` variants, not media queries). `--nav-h` CSS custom property holds nav height for layout calculations.

## Security

- All persistence is IndexedDB only (`ai-chat-config` / `chat-history` DBs). No backend, no `localStorage`/`sessionStorage`.
- API keys: never log them, put them in error messages, or expose them in the DOM. The `Authorization` header is added only when `config.apiKey` is non-empty — keep that conditional, don't send it unconditionally.
- `config.endpoint` is used directly in `fetch` with no sanitization — that's intentional, users point it at their own local/remote LLM servers. Never relay the API key to any URL other than that endpoint.
- LLM responses are rendered with `marked` + `DOMPurify.sanitize(...)` (see `ChatAndSettings.tsx`) to prevent XSS. If `marked` options change, re-verify that `<script>`/event-handler content in model output still gets stripped.
- Never `eval()` or `new Function()` on LLM response content.
- GPT4ALL CORS is handled via the Vite dev proxy and `sirv --cors` in production; don't work around CORS with `mode: "no-cors"`.

## Subagents

Use the following sub-agents in parallel, if available.

- **Code Review:** `code-reviewer`
- **Test:** `code-tester`
