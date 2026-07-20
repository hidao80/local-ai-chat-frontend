---
name: analyzed-databases
description: IndexedDB storage architecture, schemas, and access patterns (no backend/server-side storage exists).
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Databases

## Table of Contents

- [DB 1: ai-chat-config](#db-1-ai-chat-config)
- [DB 2: chat-history](#db-2-chat-history)
- [Security Notes](#security-notes)

All persistence is IndexedDB only. No backend, no server-side storage — confirmed by [[security]] and `.claude/rules/security.md`.

---

## DB 1: `ai-chat-config`

**Purpose**: Store user configuration (LLM endpoint, API key, provider, model, system prompts, language, dark mode).

**Owner**: `src/App.tsx`

| Property | Value |
|----------|-------|
| DB Name | `ai-chat-config` |
| Store Name | `config` |
| Version | 1 |
| Key | `"main"` (single record) |

### Record Schema

```typescript
type StoredConfig = ApiConfig & {
  systemPrompts?: Record<string, string>; // key: "${provider}-${model||'default'}"
  lang?: string;                          // "en" or "ja"
  dark?: boolean;
};
```

### Access Patterns

| Operation | Trigger |
|-----------|---------|
| **Read** (`get("main")`) | App mount (`useEffect`, once) via `loadConfigFromDB()` |
| **Write** (`put(data, "main")`) | Settings ↔ Chat toggle (`handleToggle`), language toggle (`toggleLang`), dark mode toggle (`toggleDark`) — all in `src/App.tsx` |

---

## DB 2: `chat-history`

**Purpose**: Persist chat sessions (message history).

**Owner**: `src/components/ChatAndSettings.tsx` (`Chat` component)

| Property | Value |
|----------|-------|
| DB Name | `chat-history` |
| Store Name | `sessions` |
| Version | 1 |
| Key Path | `id` |

### Record Schema

```typescript
type ChatSession = {
  id: string;          // "session-${Date.now()}"
  title: string;       // First 50 chars of first user message
  messages: Message[];
  createdAt: number;   // Unix timestamp (ms)
  updatedAt: number;   // Unix timestamp (ms)
};

type Message = {
  role: string;              // "user" or "assistant"
  content: string;
  model?: string;
  provider?: ApiConfig["provider"];
  reasoningEffort?: string;
  tokensPerSecond?: number;
  timestamp?: number;
};
```

### Access Patterns

| Operation | Trigger |
|-----------|---------|
| **Read all** (`getAll()` → sort by `updatedAt` desc) | `Chat` component mount, and after every save/delete |
| **Read one** (`get(id)`) | `loadSession()` — user clicks a session in `ChatSidebar` |
| **Write** (`put(session)`) | `useEffect` on every `messages` change (auto-save, `createdAt` is reset to `Date.now()` on every save — see Notes) |
| **Delete** (`delete(id)`) | `deleteSession()` — user confirms via `ConfirmModal` |

### Notes

- No migration logic; both stores are created fresh at version 1 (`onupgradeneeded`).
- **Factual bug**: `saveChatSession`'s caller in `Chat`'s effect rebuilds the full `ChatSession` object including `createdAt: Date.now()` on *every* save, not just the first — the original creation timestamp is not preserved across the session's lifetime. See [[known_bugs]].
- No pagination; all sessions are loaded into component state on mount (see [[performance]]).

---

## Security Notes

- API keys are stored in `ai-chat-config` IndexedDB. They are never logged, included in error messages, or exposed in the DOM (per `.claude/rules/security.md`).
- `localStorage` / `sessionStorage` are not used. IndexedDB is the single source of truth.
- No cross-origin or server-side access to stored data — everything lives in the browser's origin-scoped storage.

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
