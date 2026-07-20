---
name: analyzed-screens
description: User-facing screens, entry point, routing mechanism, and view conventions.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Screens

## Table of Contents

- [Entry Point](#entry-point)
- [Default Route / URL Pattern](#default-route--url-pattern)
- [Controller/Base Class Equivalent](#controllerbase-class-equivalent)
- [View File Convention](#view-file-convention)
- [Screen 1: Settings](#screen-1-settings-screen-default)
- [Screen 2: Chat](#screen-2-chat-screen)
- [Navigation Bar (shared)](#navigation-bar-shared)

---

## Entry Point

`index.html` → `src/main.tsx` → `<App />` (`src/App.tsx`), rendered into `#root` inside `<StrictMode>`.

## Default Route / URL Pattern

**Factual**: There is no router library and no URL-based routing. The entire app is served at `/` (single route). Screen selection is a single in-memory boolean `showSettings` in `App.tsx`:

- `showSettings = true` (initial default) → Settings screen
- `showSettings = false` → Chat screen

No deep-linking, no browser history entries, no query params consumed.

## Controller/Base Class Equivalent

**N/A** — this is a client-only React SPA with no MVC controller layer. The closest analogue is `App.tsx` acting as the single top-level state owner / "controller," passing props down to `<Settings>` and `<Chat>`. There is no base class or inheritance hierarchy (functional components only, per [[code-style]]).

## View File Convention

All screen components live in two files:

| File | Exports |
|---|---|
| `src/App.tsx` | `App` (default) — root/layout + nav |
| `src/components/ChatAndSettings.tsx` | `Settings`, `Chat` (named) + private sub-components `ConfirmModal`, `ChatSidebar`, `Minimap` |

No per-screen file split, no template engine — JSX inline in the same file as logic. See [[components]].

---

## Screen 1: Settings Screen (default)

**Component**: `<Settings>` (in `src/components/ChatAndSettings.tsx`)

**Purpose**: Configure the LLM provider, endpoint, API key, model, reasoning effort, and system prompt.

### Layout

- Max width: `max-w-2xl`, centered
- Sticky top nav (shared across screens)

### Sections

| Section | Input Type | Notes |
|---------|-----------|-------|
| Provider | `<select>` | openai / lmstudio / gpt4all / ollama / llamacpp |
| Endpoint | `<input type="text">` | Auto-filled on provider change; user-editable |
| API Key | `<input type="password">` | Optional; sent as Bearer token only if non-empty |
| Model | `<select>` | Auto-populated from provider endpoint; shows 🧠 for reasoning models |
| Reasoning Effort | `<select>` | Visible only when selected model is a reasoning model AND provider is not `gpt4all` |
| System Prompt | `<textarea rows="3">` | Per-provider-model prompt; Copy button with 2s feedback |

### Interactions

- **Provider change** → resets endpoint to provider default, clears model selection
- **Model list** → fetched on `provider`, `endpoint`, `apiKey` change
- **Save** → config is saved to IndexedDB when the user navigates to Chat (via `handleToggle()` in `App.tsx`)

---

## Screen 2: Chat Screen

**Component**: `<Chat>` (in `src/components/ChatAndSettings.tsx`)

**Purpose**: Send messages to the configured LLM and view conversation history.

### Layout

- Max width: `max-w-6xl`, full height flex column
- Left sidebar: Chat history sessions
- Center: Scrollable message list + input bar
- Right edge: Minimap (portaled into `#minimap-portal`)

### Sub-areas

| Area | Description |
|------|-------------|
| Sidebar | Chat session history; open/close via hamburger on mobile |
| Header | Hint text (desktop), hamburger button (mobile) |
| Message list | Scrollable; user messages right-aligned blue, AI messages left-aligned gray |
| Scroll-to-bottom button | Appears when user scrolls up; clicks to jump to latest |
| Input area | Single-line text input + send button; Enter to send |
| Minimap | 5px-wide right-edge bar showing conversation overview |

### Message Metadata (AI messages)

- `AI (Provider: Model / reasoningEffort)`
- Tokens/second (if available)
- Timestamp

### Interactions

- **Send message**: Enter key or send button
- **Copy message**: Hover button; shows ✓ for 2 seconds
- **New chat**: Sidebar "New Chat" button
- **Load session**: Click session in sidebar
- **Delete session**: Trash icon in sidebar → confirm modal
- **Minimap click**: Smooth-scroll to that message

---

## Navigation Bar (shared)

- Always visible at top (sticky, height exposed as `--nav-h` CSS var via `useLayoutEffect` in `App.tsx`)
- Left: App title "llm Chat-FE"
- Right: Language toggle (EN/JA), dark mode toggle (☀/☽), Settings/Chat button

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
