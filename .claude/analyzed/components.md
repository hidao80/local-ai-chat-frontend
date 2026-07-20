---
name: analyzed-components
description: Application structure and detailed responsibilities of each React component.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Components

## Table of Contents

- [Application Structure](#application-structure)
- [App](#app-srcapptsx)
- [Settings](#settings-srccomponentschatandsettingstsx)
- [Chat](#chat-srccomponentschatandsettingstsx)
- [ChatSidebar](#chatsidebar-srccomponentschatandsettingstsx)
- [ConfirmModal](#confirmmodal-srccomponentschatandsettingstsx)
- [Minimap](#minimap-srccomponentschatandsettingstsx)
- [Type Definitions](#type-definitions)

---

## Application Structure

All components are functional (no class components, per [[code-style]]). No custom vendor namespace/package scope is used — the app is not published as a scoped npm package (`"name": "local-ai-chat-frontend"`, unscoped). Two files hold all component code:

```
src/App.tsx                          # App (root)
src/components/ChatAndSettings.tsx   # Settings, Chat (exported)
                                      # ConfirmModal, ChatSidebar, Minimap (private)
```

---

## App (`src/App.tsx`)

Root component. Manages global state and renders nav + content.

### State

| State | Type | Persisted |
|-------|------|-----------|
| `config` | `ApiConfig` | Yes (IndexedDB) |
| `showSettings` | `boolean` | No (runtime only) |
| `systemPrompts` | `Record<string, string>` | Yes (IndexedDB) |
| `dark` | `boolean` | Yes (IndexedDB) |
| `i18n.language` | `string` | Yes (IndexedDB) |

### Key Functions

- `toggleLang()` — Switch en ↔ ja; saves to IndexedDB
- `toggleDark()` — Toggle dark mode; saves to IndexedDB
- `handleToggle()` — Switch Settings ↔ Chat; saves config to IndexedDB
- `getSystemPromptKey()` — Returns `"${provider}-${model||'default'}"`
- `updateSystemPrompt(prompt)` — Updates `systemPrompts` map at the current key

### Layout

```
<html class="dark?">
  <body>
    <nav ref={navRef}> (sticky, sets --nav-h CSS var via useLayoutEffect)
    <main>
      <div id="minimap-portal"> (fixed right edge, portal target)
      <Settings> or <Chat>
```

---

## Settings (`src/components/ChatAndSettings.tsx`)

**Props**: `{ config, setConfig, systemPrompt, setSystemPrompt }`

**Internal state**: `availableModels`, `loadingModels`, `modelsError`, `copiedPrompt`

**Behavior**:
- Fetches model list when `provider`, `endpoint`, or `apiKey` changes
- Provider change → resets endpoint to default, clears model
- Reasoning effort selector shown only if `isReasoningModel(model)` is true and provider ≠ `gpt4all`
- Copy system prompt button: 2-second visual feedback

**Model fetch endpoints**:

| Provider | List endpoint | Detail endpoint |
|----------|----------|----------|
| ollama | `${endpoint}/api/tags` | `${endpoint}/api/show` (direct fetch — fixed from a hardcoded `/api/ollama/api/show` proxy path that 404'd; see [[known_bugs]]) |
| gpt4all | `/api/gpt4all/v1/models` (Vite proxy, dev-only) | — |
| openai / lmstudio / llamacpp | `${endpoint}/v1/models` | — |

---

## Chat (`src/components/ChatAndSettings.tsx`)

**Props**: `{ config, systemPrompt }`

**State**: `messages`, `input`, `loading`, `atBottom`, `currentSessionId`, `chatSessions`, `sidebarOpen`, `copiedMessageIndex`

**Refs**: `scrollRef` (bottom sentinel), `scrollContainerRef` (scroll container), `messageRefs` (per-message DOM nodes)

**Effects**:
1. Load all sessions on mount
2. Auto-save current session when `messages` changes (see caveat in [[databases]])
3. Auto-scroll to bottom on mount
4. Track scroll position (`atBottom` flag) via scroll/resize listeners
5. Render minimap via portal into `#minimap-portal`

**`sendMessage()` flow**:
1. Validate (non-empty input, not loading)
2. Build request: system prompt + history + new user message
3. Determine endpoint & body by provider
4. `fetch` (no streaming — full response awaited)
5. Parse response (provider-specific)
6. Calculate tokens/sec from response metadata
7. Append AI message with model/provider/reasoning/tokens/timestamp

**Chat endpoint routing**:

| Provider | Endpoint | Reasoning param |
|----------|----------|----------------|
| ollama | `${endpoint}/api/chat` | `think` |
| gpt4all | `/api/gpt4all/v1/chat/completions` (Vite proxy, dev-only) | — (unsupported) |
| openai / lmstudio / llamacpp | `${endpoint}/v1/chat/completions` | `reasoning_effort` |

**Response parsing**:
- Ollama: `data.message.content`, tokens from `data.eval_count`
- OpenAI-compatible: `data.choices[0].message.content`, tokens from `data.usage.total_tokens`

---

## ChatSidebar (`src/components/ChatAndSettings.tsx`)

**Props**: `{ sessions, currentSessionId, onLoadSession, onNewChat, onDeleteSession, isOpen, onClose }`

**Internal state**: `deleteTargetId: string | null`

**Behavior**:
- Mobile: fixed overlay, hidden by default (`isOpen` controls visibility via `translate-x` transform)
- Desktop (`lg:` breakpoint): static sidebar, always visible
- Session list: sorted by `updatedAt` descending (newest first)
- Session title: first 50 chars of first user message
- Delete: click trash icon → `ConfirmModal` → calls `onDeleteSession`

---

## ConfirmModal (`src/components/ChatAndSettings.tsx`)

**Props**: `{ isOpen, title, message, onConfirm, onCancel }`

**Behavior**:
- Renders via `createPortal()` into `document.body`
- Fixed full-screen backdrop (semi-transparent); clicking it calls `onCancel`
- Buttons: Cancel (gray), Delete/Confirm (red)

---

## Minimap (`src/components/ChatAndSettings.tsx`)

**Props**: `{ messages, scrollContainerRef, messageRefs }`

**Behavior**:
- Rendered via `createPortal()` into `#minimap-portal`
- 5px-wide vertical bar at right edge of screen
- Blue blocks = user messages; gray blocks = AI messages
- Blue-bordered overlay = current viewport scroll position (computed from `scrollTop`/`scrollHeight`/`clientHeight` via `ResizeObserver` + scroll listener)
- Click block → smooth scroll to that message (centered)
- Hover block → tooltip with first 40 chars of message content

---

## Type Definitions

Defined in `src/components/ChatAndSettings.tsx`:

```typescript
export type ApiConfig = {
  endpoint: string;
  apiKey: string;
  provider: "openai" | "lmstudio" | "gpt4all" | "ollama" | "llamacpp";
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
};

type Message = {
  role: string;           // "user" or "assistant"
  content: string;
  model?: string;
  provider?: ApiConfig["provider"];
  reasoningEffort?: string;
  tokensPerSecond?: number;
  timestamp?: number;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

type ModelInfo = {
  id: string;
  supportsReasoning: boolean;
};
```

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
