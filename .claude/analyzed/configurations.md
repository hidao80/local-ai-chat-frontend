---
name: analyzed-configurations
description: Main configuration files and environment-specific settings.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Configurations

## Table of Contents

- [Build & Dev](#build--dev)
- [TypeScript](#typescript)
- [Linting/Formatting](#lintingformatting)
- [Runtime Configuration (ApiConfig)](#runtime-configuration-apiconfig)
- [Environment Variables](#environment-variables)
- [Package Manager](#package-manager)
- [i18n](#i18n)
- [Tailwind CSS](#tailwind-css)
- [Playwright (E2E)](#playwright-e2e)

---

## Build & Dev

`vite.config.ts` — see full content in [[infrastructure]] context; key facts:
- Dev-only proxy: `/api/gpt4all` → `http://localhost:4891` (rewrite strips prefix)
- Plugin: `@vitejs/plugin-react`
- Output: `dist/`
- **Not applied** when serving `dist/` from a static host (Apache/nginx) — see [[known_bugs]] #4.

## TypeScript

Three-file project reference setup, all `strict: true` + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch` + `noUncheckedSideEffectImports` + `erasableSyntaxOnly`:

| File | Scope | Target |
|------|-------|--------|
| `tsconfig.json` | Root references only | — |
| `tsconfig.app.json` | `src/`, `tailwind.config.js` | ES2022 |
| `tsconfig.node.json` | `vite.config.ts` | ES2023 |

JSX: `react-jsx` (automatic runtime).

## Linting/Formatting

**Two linters coexist** (Factual, unconfirmed why both are retained):
- **Biome** (`biome.json`, schema `2.5.4`) — primary, per [[code-style]]. Scope `src`, `tests`; excludes `dist`. 2-space indent, double quotes, `organizeImports: on`.
- **ESLint** (`eslint.config.js`, flat config) — `js.configs.recommended` + `tseslint.configs.recommended` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. Not wired into any `package.json` script or CI workflow (Factual — only `biome ci .` runs in `lint.yml`).

Speculative (★2 confidence): ESLint config may be a legacy holdover or IDE-only integration (react-hooks/react-refresh rules not covered by Biome's recommended preset). Recommend confirming intent before removing.

## Runtime Configuration (ApiConfig)

Defined in `src/components/ChatAndSettings.tsx`:

```typescript
type ApiConfig = {
  endpoint: string;
  apiKey: string;
  provider: "openai" | "lmstudio" | "gpt4all" | "ollama" | "llamacpp";
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};
```

### Default Endpoints by Provider

| Provider | Default Endpoint (code) | README.md value |
|----------|-----------------|---|
| openai | `https://api.openai.com` | matches |
| lmstudio | `http://localhost:1234` | states `http://localhost:12345` — **mismatch**, see [[known_bugs]] |
| gpt4all | `http://localhost:4891` | matches |
| ollama | `http://localhost:11434` | matches |
| llamacpp | `http://localhost:8080` | matches |

Persisted to IndexedDB — see [[databases]] `ai-chat-config`.

## Environment Variables

No `VITE_*` variables are defined or embedded in the bundle. `PORT` / `HOST` are read only by `bin/start.js` (production sirv-cli server, defaults `3000` / `localhost`).

## Package Manager

- **pnpm@11.6.0** (declared in `package.json` `packageManager` — note: `overview`/`architecture` docs predating this analysis stated `10.28.2`, now stale)
- `.npmrc`: `strict-peer-dependencies=false`, `ignore-scripts=true`, `min-release-age=7`
- `pnpm-workspace.yaml`: `allowBuilds: { esbuild: true }` (explicit opt-in required because `ignore-scripts=true` blocks all install scripts by default)

## i18n

`src/i18n.ts` — auto-detects `navigator.language` (ja/en), fallback `en`, 32 keys per locale (`src/locales/en.json`, `ja.json`). `provider` key is untranslated in `ja.json` (renders literal "Provider").

## Tailwind CSS

`tailwind.config.js`: content `index.html` + `src/**/*.{js,ts,jsx,tsx}`; plugin `@tailwindcss/typography`. Dark mode variant defined in `src/index.css`: `@variant dark (.dark &);`, toggled via `.dark` class on `<html>` — see [[code-style]].

## Playwright (E2E)

`playwright.config.ts`: test dir `tests/e2e/`, base URL `http://localhost:5173`, projects `mobile`(375×812)/`tablet`(768×1024)/`fhd`(1920×1080), reporter `html`, auto-starts `pnpm run dev`, retries 2 in CI / 0 local. See [[test]].

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
