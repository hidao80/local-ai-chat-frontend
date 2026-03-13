# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Vite, http://localhost:5173)
pnpm build            # Type-check + build to dist/
pnpm lint             # Biome lint
pnpm format           # Biome format
pnpm exec tsc --noEmit  # Type-check only
pnpm preview          # Serve built dist/
pnpm start            # Serve dist/ via sirv-cli (production mode)

# E2E tests (Playwright)
pnpm test:e2e         # Run all E2E tests headless
pnpm test:e2e:ui      # Playwright UI mode
pnpm test:e2e:headed  # Run headed
pnpm screenshot       # Run screenshot spec only

# Docker
docker compose up                          # Dev
docker build -t local-ai-chat-frontend .  # Production image
docker run -p 80:80 local-ai-chat-frontend
```

After any code change, confirm `pnpm build` exits 0.

## Architecture

This is a **single-page React 19 + TypeScript + Vite** app with no backend. All data is persisted in **IndexedDB** (native browser API, no ORM).

### Key files

| File | Role |
|------|------|
| `src/App.tsx` | Root component. Manages global state (config, dark mode, i18n, system prompts). Persists everything to IndexedDB. |
| `src/components/ChatAndSettings.tsx` | All UI logic — `Settings` and `Chat` components. LLM API calls, chat history, minimap, streaming responses, per-model system prompts. |
| `src/i18n.ts` | i18next initialization. Loads `locales/en.json` and `locales/ja.json`. Auto-detects browser language. |
| `src/utils/maked.js` | Legacy markdown helper (unused — `ChatAndSettings.tsx` imports `marked` directly). |
| `bin/start.js` | Entry point for `npx`/`pnpm dlx` usage. Starts sirv-cli to serve `dist/`. |
| `vite.config.ts` | Vite config. Dev proxy: `/api/gpt4all` → `http://localhost:4891`. |

### State management

- `App.tsx` owns the top-level state: `ApiConfig` (endpoint, apiKey, provider, model, reasoningEffort), `systemPrompts` (keyed by `${provider}-${model}`), `dark`, language.
- `showSettings` boolean switches between `<Settings>` and `<Chat>` — no router.
- All state is saved to IndexedDB on toggle and language/dark mode change.

### LLM provider integration

`Chat` component in `ChatAndSettings.tsx` sends `fetch` requests to OpenAI-compatible endpoints. Provider-specific logic:
- **GPT4ALL** (dev only): proxied via Vite to avoid CORS. In prod, sirv is started with `--cors`.
- **Ollama**: requires `OLLAMA_ORIGINS=*` on the server side. Uses `think` param for reasoning.
- **OpenAI / LM Studio / llama.cpp**: use `reasoning_effort` param.

Reasoning model detection (`isReasoningModel()`) checks model name for patterns: `o1`, `reasoning`, `gpt-oss`, `deepseek-r1`.

### Styling

Tailwind CSS 4 with dark mode via `.dark` class on `<html>`. Nav height exposed as `--nav-h` CSS custom property for layout math.

### i18n

Two locales: `src/locales/en.json` and `src/locales/ja.json`. Add keys to both files when adding new UI strings.

## TypeScript config

Three tsconfig files: `tsconfig.json` (references), `tsconfig.app.json` (src/), `tsconfig.node.json` (vite.config.ts). Strict mode enabled.

## Linting & formatting

Uses **Biome** (not ESLint) for both lint and format. `eslint`/`eslint-plugin-*` remain in devDependencies but `pnpm lint` and `pnpm format` both invoke Biome.
