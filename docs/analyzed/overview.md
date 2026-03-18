---
name: analyzed-overview
description: High-level summary of the repository structure, behavior, and execution flow.
type: analysis
---

# Overview

## Project Summary

`local-ai-chat-frontend` is a single-page React 19 + TypeScript + Vite application that provides a chat UI for local and remote LLM providers. There is no backend; all data is persisted in the browser's IndexedDB.

**Package**: `local-ai-chat-frontend`
**Package Manager**: `pnpm@10.28.2`
**Entry for npx/dlx**: `bin/start.js` (sirv-cli serves `dist/`)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19.2.4 |
| Language | TypeScript ~5.8.3 (strict) |
| Build Tool | Vite 7.3.1 |
| Styling | Tailwind CSS 4.1.18 + @tailwindcss/typography |
| Dark Mode | `.dark` class on `<html>` |
| i18n | i18next 25.8.1 + react-i18next (32 keys, en/ja) |
| Markdown | marked 16.4.2 |
| Persistence | IndexedDB (native browser API) |
| Lint/Format | Biome 2.4.5 |
| E2E Testing | Playwright 1.49.0 |
| Production Server | sirv-cli 3.0.0 |
| Container | Docker / Podman (nginx) |

---

## Directory Structure

```
chat-fe/
├── .claude/               # Claude AI assistant rules and config
├── .github/workflows/     # CI: build.yml, lint.yml, audit.yml
├── bin/start.js           # Production server (npx entry)
├── dist/                  # Build output (do not commit manually)
├── docs/spec/             # This specification
├── public/favicon.png
├── src/
│   ├── App.tsx            # Root component, global state
│   ├── main.tsx           # React entry point
│   ├── index.css          # Tailwind imports + global styles
│   ├── i18n.ts            # i18next initialization
│   ├── vite-env.d.ts      # Vite type shim
│   ├── components/
│   │   └── ChatAndSettings.tsx  # All UI components (1,100+ lines)
│   └── locales/
│       ├── en.json        # English translations (34 keys)
│       └── ja.json        # Japanese translations (34 keys)
├── tests/e2e/
│   └── screenshot.spec.ts # Playwright screenshot tests
├── index.html             # HTML entry point (SEO meta, OGP)
├── Dockerfile             # Multi-stage: Node builder + nginx runner
├── docker-compose.yml     # Dev server
├── vite.config.ts         # Build config + GPT4ALL dev proxy
├── tsconfig*.json         # Three-file TypeScript config (strict)
├── biome.json             # Formatter/linter
├── tailwind.config.js     # Tailwind content + plugins
├── playwright.config.ts   # E2E test runner config
└── package.json
```

---

## Architecture

```
Browser
  └── React SPA (no router)
        ├── App.tsx
        │     ├── Global state: config, dark, language, systemPrompts
        │     ├── IndexedDB: ai-chat-config
        │     └── Renders: <Settings> or <Chat>
        └── ChatAndSettings.tsx
              ├── Settings (config form)
              ├── Chat (messages + send)
              │     ├── IndexedDB: chat-history
              │     └── fetch() → LLM provider endpoint
              ├── ChatSidebar (session list)
              ├── Minimap (portaled right edge)
              └── ConfirmModal (portaled body)
```

---

## LLM Provider Integration

Five supported providers, all via direct browser `fetch`:

| Provider | Type | Notes |
|----------|------|-------|
| openai | Remote | Requires API key |
| lmstudio | Local | OpenAI-compatible API |
| gpt4all | Local | Proxied in dev via Vite |
| ollama | Local | Custom API format; `think` param for reasoning |
| llamacpp | Local | OpenAI-compatible API |

No streaming. Full response is received, then displayed.

---

## Navigation

Single boolean `showSettings` in `App.tsx` controls which screen is visible. No router library.

- `showSettings = true` → Settings screen
- `showSettings = false` → Chat screen

---

## Internationalization

- Two locales: English (`en`) and Japanese (`ja`), 32 keys each
- Auto-detected from `navigator.language`
- Toggled via nav button; persisted to IndexedDB
- All UI strings use `t("key")` from `useTranslation()` hook
- Note: `provider` key is untranslated in `ja.json` (remains "Provider")

---

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `build.yml` | Push to main/develop | Docker build |
| `lint.yml` | Push to main/develop | Biome lint via reviewdog |
| `audit.yml` | (schedule?) | npm advisory audit |

---

## Commands Reference

```bash
pnpm install            # Install dependencies
pnpm dev                # Dev server (http://localhost:5173)
pnpm build              # tsc -b && vite build → dist/
pnpm lint               # Biome lint
pnpm format             # Biome format
pnpm exec tsc --noEmit  # Type-check only
pnpm preview            # Serve dist/ with Vite
pnpm start              # sirv-cli production server (port 3000)
pnpm test:e2e           # Playwright E2E (headless)
pnpm test:e2e:ui        # Playwright UI mode
pnpm screenshot         # Screenshot spec only

docker compose up                         # Dev container
docker build -t local-ai-chat-frontend .  # Production image
docker run -p 80:80 local-ai-chat-frontend
```

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
