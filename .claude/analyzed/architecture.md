---
name: project-architecture
description: High-level architecture, key files, and test layout for this repository
type: reference
---

## Architecture

This is a **single-page React 19 + TypeScript + Vite** app with no backend. All data is persisted in **IndexedDB** (native browser API, no ORM).

## State management

- `App.tsx` owns the top-level state: `ApiConfig` (endpoint, apiKey, provider, model, reasoningEffort), `systemPrompts` (keyed by `${provider}-${model}`), `dark`, language.
- `showSettings` boolean switches between `<Settings>` and `<Chat>` — no router.
- All state is saved to IndexedDB on toggle and language/dark mode change.

## LLM provider integration

`Chat` component in `ChatAndSettings.tsx` sends `fetch` requests to OpenAI-compatible endpoints. Provider-specific logic:
- **GPT4ALL** (dev only): proxied via Vite to avoid CORS. In prod, sirv is started with `--cors`.
- **Ollama**: requires `OLLAMA_ORIGINS=*` on the server side. Uses `think` param for reasoning.
- **OpenAI / LM Studio / llama.cpp**: use `reasoning_effort` param.

Reasoning model detection (`isReasoningModel()`) checks model name for patterns: `o1`, `reasoning`, `gpt-oss`, `deepseek-r1`.
