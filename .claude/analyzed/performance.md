---
name: analyzed-performance
description: Static analysis of processing time, parallelism, and bottleneck candidates (no runtime profiling was performed).
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Performance

## Table of Contents

- [Methodology](#methodology)
- [Bottleneck Candidates](#bottleneck-candidates)
- [Parallelism](#parallelism)
- [No Streaming](#no-streaming)

---

## Methodology

**Unconfirmed** — no browser profiling, Lighthouse run, or load test was executed as part of this analysis. Findings below are static-code-derived bottleneck *candidates*, not measured timings.

---

## Bottleneck Candidates

| # | Location | Issue | Severity (Speculative) |
|---|---|---|---|
| 1 | `loadAllChatSessions()` call sites in `Chat` | Every session is loaded into React state on mount and re-fetched after every save/delete via `getAll()` — no pagination or virtualization. Cost grows linearly with total session count across the DB lifetime. | ★3 — noticeable only for long-lived heavy users; see [[known_bugs]] #3 |
| 2 | `Chat`'s message-persistence `useEffect` | On **every** `messages` state change (i.e., every sent/received message), the *entire* `ChatSession` object — including all prior messages — is re-serialized and `put()` into IndexedDB. Cost is O(total messages in session) per turn, not O(1). | ★3 — grows with conversation length |
| 3 | Ollama model-detail fetch (`Settings`) | `Promise.all(modelNames.map(...))` fires one `POST /api/show` per model with **no concurrency cap**. An Ollama instance with many pulled models issues that many simultaneous requests. | ★2 — bounded by local Ollama's own request handling, but no client-side throttle exists |
| 4 | `marked.parse()` on every render | Each AI message's Markdown is re-parsed inline during JSX render rather than memoized, so it re-runs on every re-render of `Chat` (e.g., on scroll-position state changes), not just when `message.content` changes. | ★2 — likely negligible for short messages, could compound with many long messages on screen |

## Parallelism

- Ollama model-detail fetching (#3 above) is the only explicit `Promise.all` fan-out in the codebase. No worker threads, no Web Workers, no server-side concurrency (there is no server).
- React `StrictMode` (enabled in `main.tsx`) double-invokes effects in development only — not a production performance concern, but can make dev-mode network tab / IndexedDB write counts misleading during manual testing.

## No Streaming

`sendMessage()` in `Chat` awaits the full LLM response (`stream: false` for Ollama; no SSE/`ReadableStream` handling for OpenAI-compatible providers) before rendering anything. For slow local models or long completions, perceived latency is the full generation time, not time-to-first-token. See [[known_bugs]] #2 and [[todo]].

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
