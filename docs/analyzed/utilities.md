---
name: analyzed-utilities
description: Summary of utility modules, helper functions, and their responsibilities.
type: analysis
---

# Utilities

---

## isReasoningModel

**Location**: `src/components/ChatAndSettings.tsx` (module-level function)

**Signature**:
```typescript
function isReasoningModel(modelName: string | undefined): boolean
```

**Behavior**: Returns `true` if the model name (case-insensitive) includes any of:
- `"o1"`
- `"reasoning"`
- `"gpt-oss"`
- `"deepseek-r1"`

Returns `false` if `modelName` is `undefined` or empty.

**Usage**:
- In `Settings`: determines whether to show the Reasoning Effort selector
- In `Settings`: used when fetching Ollama model details to detect reasoning capability from modelfile content

---

## IndexedDB Helpers (Chat)

**Location**: `src/components/ChatAndSettings.tsx` (inside `Chat` component or module scope)

These are Promise-based wrappers around the native IndexedDB API.

### openChatDB

```typescript
function openChatDB(): Promise<IDBDatabase>
```

Opens (or creates) the `chat-history` database at version 1. Creates the `sessions` object store on upgrade.

### saveChatSession

```typescript
function saveChatSession(session: ChatSession): Promise<void>
```

Writes or updates a `ChatSession` to the `sessions` store using `put()`.

### loadChatSession

```typescript
function loadChatSession(id: string): Promise<ChatSession | undefined>
```

Fetches a single session by its `id` key.

### loadAllChatSessions

```typescript
function loadAllChatSessions(): Promise<ChatSession[]>
```

Fetches all sessions, sorted by `updatedAt` descending (newest first).

### deleteChatSession

```typescript
function deleteChatSession(id: string): Promise<void>
```

Deletes a session by its `id` key.

---

## IndexedDB Helpers (Config)

**Location**: `src/App.tsx`

### loadConfigFromDB

```typescript
async function loadConfigFromDB(): Promise<void>
```

Opens `ai-chat-config` DB, reads the record at key `"main"`, and restores `config`, `systemPrompts`, language, and dark mode state.

### saveConfigToDB

```typescript
async function saveConfigToDB(): Promise<void>
```

Writes the current `config`, `systemPrompts`, `i18n.language`, and `dark` to IndexedDB at key `"main"`.

---

## i18n Initialization

**Location**: `src/i18n.ts`

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

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

**Location**: `src/components/ChatAndSettings.tsx` (inside `Chat` message rendering)

```typescript
import { marked } from "marked";
// ...
<div dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }} />
```

- LLM response content is parsed with `marked` and rendered as raw HTML.
- **Security note**: `dangerouslySetInnerHTML` is used with no additional sanitization. XSS from malicious LLM responses is a theoretical risk. See `docs/spec/known_bugs.md`.

---

## bin/start.js (Production Server)

**Location**: `bin/start.js`

Entry point for `pnpm start` / `npx local-ai-chat-frontend`.

- Spawns `sirv-cli` serving `dist/` via `npx sirv-cli`
- Port: `process.env.PORT` (default `3000`)
- Host: `process.env.HOST` (default `localhost`)
- Flags: `--single` (SPA routing), `--cors`, `--dev`
- Prints startup banner with server URL and LLM provider port hints
- Graceful shutdown on `SIGINT`/`SIGTERM`

---

## src/utils/maked.js

**Location**: `src/utils/maked.js`

Empty file (0 bytes). Legacy artifact; `ChatAndSettings.tsx` imports `marked` directly. Safe to delete.

---

## src/App.css

**Location**: `src/App.css`

Empty file (0 bytes). Project uses Tailwind CSS 4 exclusively. Safe to delete.

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
