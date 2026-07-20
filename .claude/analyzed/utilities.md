---
name: analyzed-utilities
description: Global helper functions, IndexedDB wrappers, and utility modules.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Utilities

## Table of Contents

- [isReasoningModel](#isreasoningmodel)
- [IndexedDB Helpers (Chat)](#indexeddb-helpers-chat)
- [IndexedDB Helpers (Config)](#indexeddb-helpers-config)
- [i18n Initialization](#i18n-initialization)
- [Markdown Rendering](#markdown-rendering)
- [bin/start.js](#binstartjs)
- [Empty Legacy Files](#empty-legacy-files)

No Traits/mixins exist (not applicable to this React/TS codebase); functions below are the closest equivalent to shared helpers.

---

## isReasoningModel

**Location**: `src/components/ChatAndSettings.tsx` (module-level function)

```typescript
function isReasoningModel(modelName: string | undefined): boolean
```

Returns `true` if the model name (case-insensitive) includes any of: `"o1"`, `"reasoning"`, `"gpt-oss"`, `"deepseek-r1"`. Returns `false` if `modelName` is `undefined`/empty.

**Usage**: `Settings` (show Reasoning Effort selector), Ollama model-detail fetch (fallback reasoning detection), `Chat.sendMessage()` (decide whether to attach `think`/`reasoning_effort` param).

---

## IndexedDB Helpers (Chat)

**Location**: `src/components/ChatAndSettings.tsx`, module scope. Promise-based wrappers around the native IndexedDB API for the `chat-history` DB (see [[databases]]).

| Function | Signature | Behavior |
|---|---|---|
| `openChatDB` | `(): Promise<IDBDatabase>` | Opens/creates `chat-history` v1, creates `sessions` store (`keyPath: "id"`) on upgrade |
| `saveChatSession` | `(session: ChatSession): Promise<void>` | `put()` |
| `loadChatSession` | `(id: string): Promise<ChatSession \| null>` | `get(id)` |
| `loadAllChatSessions` | `(): Promise<ChatSession[]>` | `getAll()`, sorted by `updatedAt` desc |
| `deleteChatSession` | `(id: string): Promise<void>` | `delete(id)` |

## IndexedDB Helpers (Config)

**Location**: `src/App.tsx`. Callback-based (not Promise-based, unlike the Chat helpers above — inconsistent style, see [[naming_convention]]).

| Function | Signature | Behavior |
|---|---|---|
| `saveConfigToDB` | `(config: StoredConfig): void` | Opens `ai-chat-config` v1, creates `config` store on upgrade, `put(config, "main")` |
| `loadConfigFromDB` | `(callback: (c: StoredConfig) => void): void` | Opens DB, `get("main")`, invokes callback if a record exists |

---

## i18n Initialization

**Location**: `src/i18n.ts`

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ja from "./locales/ja.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: navigator.language.startsWith("ja") ? "ja" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
```

Imported once in `src/main.tsx` for side-effect initialization.

---

## Markdown Rendering

**Location**: `src/components/ChatAndSettings.tsx` (`Chat` message rendering)

```typescript
import { marked } from "marked";
// ...
<span dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }} />
```

LLM response content is parsed with `marked` and rendered as raw HTML with no additional sanitization. See [[security]] and [[known_bugs]] #1 (XSS risk).

---

## bin/start.js (Production Server)

**Location**: `bin/start.js`. Entry point for `pnpm start` / `npx local-ai-chat-frontend`.

- Spawns `sirv-cli` serving `dist/` via `npx sirv-cli`
- Port: `process.env.PORT` (default `3000`); Host: `process.env.HOST` (default `localhost`)
- Flags: `--single` (SPA routing), `--cors`, `--dev`
- Prints startup banner with server URL and recommended LLM provider ports
- Graceful shutdown on `SIGINT`/`SIGTERM`

---

## Empty Legacy Files

| File | Status |
|---|---|
| `src/utils/maked.js` | 0 bytes. `ChatAndSettings.tsx` imports `marked` directly. Safe to delete — see [[todo]]. |
| `src/App.css` | 0 bytes. Tailwind CSS handles all styling. Safe to delete — see [[todo]]. |

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
