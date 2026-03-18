---
name: analyzed-components
description: Detailed explanation of the repository's main components and their responsibilities.
type: analysis
---

# Components

All components are functional (no class components). Located in `src/App.tsx` and `src/components/ChatAndSettings.tsx`.

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
- `updateSystemPrompt(key, value)` — Updates systemPrompts map

### Layout

```
<html class="dark?">
  <body>
    <nav> (sticky, --nav-h CSS var)
    <main>
      <div id="minimap-portal"> (right edge)
      <Settings> or <Chat>
```

---

## Settings (`src/components/ChatAndSettings.tsx`)

**Props**:
```typescript
{
  config: ApiConfig;
  setConfig: (c: ApiConfig) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
}
```

**Internal state**:
- `availableModels: ModelInfo[]`
- `loadingModels: boolean`
- `modelsError: string`
- `copiedPrompt: boolean`

**Behavior**:
- Fetches model list when `provider`, `endpoint`, or `apiKey` changes
- Provider change → resets endpoint to default, clears model
- Reasoning effort selector shown only if `isReasoningModel(model)` is true
- Copy system prompt button: 2-second visual feedback

**Model fetch endpoints**:

| Provider | Endpoint |
|----------|----------|
| ollama | `${endpoint}/api/tags` |
| gpt4all | `/api/gpt4all/v1/models` (Vite proxy) |
| openai / lmstudio / llamacpp | `${endpoint}/v1/models` |

---

## Chat (`src/components/ChatAndSettings.tsx`)

**Props**:
```typescript
{
  config: ApiConfig;
  systemPrompt: string;
}
```

**State**:
```typescript
messages: Message[]
input: string
loading: boolean
atBottom: boolean
currentSessionId: string
chatSessions: ChatSession[]
sidebarOpen: boolean
copiedMessageIndex: number | null
```

**Refs**:
- `scrollRef` — Bottom-of-list sentinel for auto-scroll
- `scrollContainerRef` — Scroll container (for position tracking + minimap)
- `messageRefs` — Array of message DOM nodes

**Effects**:
1. Load all sessions on mount
2. Auto-save current session when messages change
3. Auto-scroll to bottom on new messages (if `atBottom` is true)
4. Track scroll position (`atBottom` flag)
5. Render minimap via portal

**`sendMessage()` flow**:
1. Validate (non-empty input, not loading)
2. Build request: system prompt + history + new user message
3. Determine endpoint & body by provider
4. Fetch (no streaming — full response)
5. Parse response (provider-specific)
6. Calculate tokens/sec from response metadata
7. Append AI message with model/provider/reasoning/tokens/timestamp

**Chat endpoint routing**:

| Provider | Endpoint | Reasoning param |
|----------|----------|----------------|
| ollama | `${endpoint}/api/chat` | `think` |
| gpt4all | `/api/gpt4all/v1/chat/completions` | — |
| openai / lmstudio / llamacpp | `${endpoint}/v1/chat/completions` | `reasoning_effort` |

**Response parsing**:
- Ollama: `data.message.content`, tokens from `data.eval_count`
- OpenAI-compatible: `data.choices[0].message.content`, tokens from `data.usage.total_tokens`

---

## ChatSidebar (`src/components/ChatAndSettings.tsx`)

**Props**:
```typescript
{
  sessions: ChatSession[];
  currentSessionId: string;
  onLoadSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}
```

**Internal state**:
- `deleteTargetId: string | null` — ID of session pending deletion

**Behavior**:
- Mobile: fixed overlay, hidden by default (`isOpen` controls visibility)
- Desktop (lg+): static sidebar, always visible
- Session list: sorted by `updatedAt` descending (newest first)
- Session title: first 50 chars of first user message
- Delete: click trash icon → `ConfirmModal` → calls `onDeleteSession`

---

## ConfirmModal (`src/components/ChatAndSettings.tsx`)

**Props**:
```typescript
{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Behavior**:
- Renders via `createPortal()` into `document.body`
- Fixed full-screen backdrop (semi-transparent)
- Clicking backdrop → calls `onCancel`
- Buttons: Cancel (gray), Delete/Confirm (red)

---

## Minimap (`src/components/ChatAndSettings.tsx`)

**Props**:
```typescript
{
  messages: Message[];
  scrollContainerRef: RefObject<HTMLDivElement>;
  messageRefs: MutableRefObject<(HTMLDivElement | null)[]>;
}
```

**Behavior**:
- Rendered via `createPortal()` into `#minimap-portal`
- 5px-wide vertical bar at right edge of screen
- Blue blocks = user messages; gray blocks = AI messages
- Blue border overlay = current viewport scroll position
- Click block → smooth scroll to that message (centered)
- Hover block → tooltip with first 40 chars of message content
- Updates on scroll/resize events

---

## Type Definitions

Defined in `src/components/ChatAndSettings.tsx`:

```typescript
type ApiConfig = {
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

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
