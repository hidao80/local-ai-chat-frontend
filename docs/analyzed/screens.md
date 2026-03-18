---
name: analyzed-screens
description: Overview of user-facing screens, views, or VS Code surfaces used by the extension.
type: analysis
---

# Screens

## Overview

The app uses a single boolean `showSettings` in `App.tsx` to switch between two screens. There is no router library.

---

## Screen 1: Settings Screen (default)

**Route**: `/` (initial state, `showSettings = true`)

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
| Reasoning Effort | `<select>` | Visible only when selected model is a reasoning model |
| System Prompt | `<textarea rows="3">` | Per-provider-model prompt; Copy button with 2s feedback |

### Interactions

- **Provider change** → resets endpoint to provider default, clears model selection
- **Model list** → fetched on `provider`, `endpoint`, `apiKey` change
- **Save** → config is saved to IndexedDB when the user navigates to Chat (via `handleToggle()` in `App.tsx`)

---

## Screen 2: Chat Screen

**Route**: `/` (after clicking nav button, `showSettings = false`)

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

- Always visible at top (sticky)
- Left: App title / logo area
- Right: Language toggle (EN/JA), dark mode toggle, Settings/Chat button

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
