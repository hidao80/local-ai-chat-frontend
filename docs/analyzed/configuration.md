---
name: analyzed-configurations
description: Explanation of configuration options, defaults, and related behavior in the extension.
type: analysis
---

# Configuration

## Build & Dev Configuration

### vite.config.ts

```typescript
// Dev proxy: /api/gpt4all → http://localhost:4891
server.proxy['/api/gpt4all'] = {
  target: 'http://localhost:4891',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/gpt4all/, '')
}
```

- Plugin: `@vitejs/plugin-react` (React 19 fast refresh)
- Output: `dist/`
- No HTTPS config (removed; was via `@vitejs/plugin-basic-ssl`)

### TypeScript

Three tsconfig files:

| File | Scope | Target |
|------|-------|--------|
| `tsconfig.json` | Root references | — |
| `tsconfig.app.json` | `src/` | ES2022 |
| `tsconfig.node.json` | `vite.config.ts` | ES2023 |

All three: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`

JSX: `react-jsx` (automatic runtime, no explicit React import required)

### biome.json

- Indent: 2 spaces
- Quotes: double quotes (JS/TS)
- Scope: `src/` and `tests/`
- Import organization: enabled (`organizeImports: on`)
- Linter: recommended rules

---

## Runtime Configuration (ApiConfig)

Defined in `src/components/ChatAndSettings.tsx`, consumed by `App.tsx` and `Chat`.

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

| Provider | Default Endpoint |
|----------|-----------------|
| openai | `https://api.openai.com` |
| lmstudio | `http://localhost:1234` |
| gpt4all | `http://localhost:4891` |
| ollama | `http://localhost:11434` |
| llamacpp | `http://localhost:8080` |

### Persistence

Saved to IndexedDB (`ai-chat-config` DB, `config` store, key `"main"`) as:

```typescript
type StoredConfig = ApiConfig & {
  systemPrompts: Record<string, string>; // keyed by `${provider}-${model||"default"}`
  lang: string;
  dark: boolean;
};
```

Loaded on `App` mount via `loadConfigFromDB()`. Saved on Settings toggle and on language/dark mode change.

---

## Environment Variables

No environment variables are used at runtime. `VITE_*` variables would be embedded in the bundle — none are defined.

`PORT` and `HOST` are read in `bin/start.js` for the production sirv-cli server (default `3000` / `localhost`).

---

## Package Manager

- **pnpm@10.28.2** (specified in `package.json` `packageManager` field)
- Lock file: `pnpm-lock.yaml`
- `.npmrc`: `strict-peer-dependencies=false`

---

## i18n Configuration

File: `src/i18n.ts`

```typescript
i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: navigator.language.startsWith("ja") ? "ja" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
```

- Auto-detects browser language
- Fallback: English
- Locale files: `src/locales/en.json`, `src/locales/ja.json`

---

## Tailwind CSS

`tailwind.config.js`:
- Content: `index.html`, `src/**/*.{js,ts,jsx,tsx}`
- Plugin: `@tailwindcss/typography`
- Dark mode: `.dark` class on `<html>` (configured in `index.css` via `@variant dark (.dark &)`)

---

## Playwright (E2E)

`playwright.config.ts`:
- Test dir: `tests/e2e/`
- Base URL: `http://localhost:5173`
- Projects: mobile (375×812), tablet (768×1024), FHD (1920×1080)
- Reporter: HTML
- Web server: auto-starts `pnpm run dev`
- Retries: 2 (CI), 0 (local)

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
