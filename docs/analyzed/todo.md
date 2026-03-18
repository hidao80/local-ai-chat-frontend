---
name: analyzed-todo
description: List of proposed improvements, follow-up tasks, and future work for the repository.
type: analysis
---

# TODO

Items identified from codebase analysis. Not ordered by priority.

---

## Features

- [ ] **Streaming responses** — Implement SSE / `ReadableStream` parsing for incremental LLM output display (currently waits for full response)
- [ ] **Message search** — Full-text search across all chat sessions
- [ ] **Session export** — Export chat history as JSON or Markdown
- [ ] **Session pagination** — Lazy-load sessions instead of loading all on mount
- [ ] **Custom model entry** — Allow typing a model name directly if the model list fetch fails or is incomplete
- [ ] **Multi-modal support** — Image input for vision-capable models

---

## Quality / Reliability

- [ ] **XSS mitigation** — Add DOMPurify (or equivalent) to sanitize `marked` output before `dangerouslySetInnerHTML`
- [ ] **GPT4ALL production proxy** — Document or implement a production-compatible solution for GPT4ALL CORS (currently dev-only via Vite proxy)
- [ ] **Error recovery** — Distinguish network errors from API errors; show actionable messages
- [ ] **Reasoning model opt-in** — Allow user to manually override reasoning model detection for unsupported model names

---

## Testing

- [ ] **Unit tests** — Set up Vitest for `isReasoningModel()` and IndexedDB helpers
- [ ] **E2E: send message** — Mock LLM endpoint in Playwright and test full send/receive flow
- [ ] **E2E: settings persistence** — Verify config survives page reload
- [ ] **E2E: session management** — Create, rename, delete sessions
- [ ] **E2E: dark mode / language** — Toggle and verify UI changes

---

## Cleanup

- [ ] **Remove unused dependencies** — Evaluate `bootstrap`, `@heroicons/react` (neither used in source)
- [ ] **Remove `src/utils/maked.js`** — Legacy file; `marked` is imported directly where needed
- [ ] **Remove `src/App.css`** — Empty file; serves no purpose

---

## Documentation

- [ ] **API request/response examples** — Document exact request bodies for each provider
- [ ] **Environment variables** — Document `PORT` / `HOST` for `bin/start.js`
- [ ] **Ollama setup guide** — `OLLAMA_ORIGINS=*` requirement and reasoning model configuration

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
