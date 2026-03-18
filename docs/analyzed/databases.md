---
name: analyzed-databases
description: Notes about data storage, persistence, or the absence of database usage in this repository.
type: analysis
---

# Databases

All persistence is IndexedDB only. No backend, no server-side storage.

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
type StoredConfig = {
  // ApiConfig fields:
  endpoint: string;
  apiKey: string;
  provider: "openai" | "lmstudio" | "gpt4all" | "ollama" | "llamacpp";
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  // Extra fields:
  systemPrompts: Record<string, string>; // key: "${provider}-${model||'default'}"
  lang: string;                          // "en" or "ja"
  dark: boolean;
};
```

### Access Patterns

| Operation | Trigger |
|-----------|---------|
| **Read** (`get("main")`) | App mount (`useEffect`, once) |
| **Write** (`put(data, "main")`) | Settings ↔ Chat toggle, language toggle, dark mode toggle |

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
  id: string;          // Unique session ID (timestamp-based)
  title: string;       // First 50 chars of first user message
  messages: Message[];
  createdAt: number;   // Unix timestamp (ms)
  updatedAt: number;   // Unix timestamp (ms)
};

type Message = {
  role: string;              // "user" or "assistant"
  content: string;
  model?: string;
  provider?: string;
  reasoningEffort?: string;
  tokensPerSecond?: number;
  timestamp?: number;
};
```

### Access Patterns

| Operation | Trigger |
|-----------|---------|
| **Read all** (`getAll()` → sort) | Chat component mount |
| **Read one** (`get(id)`) | Load session from sidebar |
| **Write** (`put(session)`) | Every message state change (auto-save) |
| **Delete** (`delete(id)`) | User confirms delete in ChatSidebar |

### Notes

- No migration logic; store is created fresh at version 1.
- Sessions are sorted in-memory by `updatedAt` descending after `getAll()`.
- No pagination; all sessions are loaded into component state on mount.

---

## Security Notes

- API keys are stored in `ai-chat-config` IndexedDB. They are never logged, included in error messages, or exposed in the DOM.
- `localStorage` / `sessionStorage` are not used. IndexedDB is the single source of truth.
- No cross-origin or server-side access to stored data.

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
