---
name: analyzed-known-bugs
description: Catalog of known bugs, limitations, and currently unresolved behavior.
type: analysis
---

# Known Bugs & Issues

---

## Active Issues

### 1. XSS via Markdown Rendering

**Severity**: Medium
**Location**: `src/components/ChatAndSettings.tsx`, `Chat` component message rendering

LLM response content is rendered using `marked.parse()` with `dangerouslySetInnerHTML`. No explicit sanitization (e.g., DOMPurify) is applied. A malicious LLM response containing `<script>` tags or event handler attributes could execute arbitrary JavaScript.

**Mitigation in place**: None beyond `marked`'s default behavior.
**Recommended fix**: Add DOMPurify or configure `marked` with a sanitizer.

---

### 2. No Response Streaming

**Severity**: Low (UX)
**Location**: `sendMessage()` in `Chat` component

The app waits for the full LLM response before displaying anything. For slow models or long outputs, the UI shows only a loading spinner with no incremental feedback.

**Recommended fix**: Implement SSE / `ReadableStream` parsing for streaming responses.

---

### 3. All Chat Sessions Loaded into Memory

**Severity**: Low (performance)
**Location**: `loadAllChatSessions()` in `Chat` component

On mount, all sessions from IndexedDB are loaded into React state. For users with many sessions, this could cause memory pressure and slow initial load.

**Recommended fix**: Paginate or lazily load session history.

---

### 4. GPT4ALL Only Proxied in Dev

**Severity**: Medium
**Location**: `vite.config.ts`, `sendMessage()` in `Chat`

GPT4ALL uses a Vite dev proxy (`/api/gpt4all → http://localhost:4891`). In production (Docker/sirv), this proxy does not exist, so GPT4ALL requests will fail with CORS or network errors.

**Workaround**: Run with `docker compose up` for dev. Production use of GPT4ALL is not supported.

---

### 5. Reasoning Model Detection is Heuristic

**Severity**: Low
**Location**: `isReasoningModel()` utility

Detection is based on model name pattern matching (`o1`, `reasoning`, `gpt-oss`, `deepseek-r1`). New or custom reasoning models with different names will not be detected, and the reasoning effort selector will not appear.

---

### 6. Session Title Uses Raw Message Content

**Severity**: Low
**Location**: `ChatSidebar` session list rendering

Session titles are set to the first 50 characters of the first user message. If the message contains markdown syntax or special characters, they appear verbatim in the sidebar title.

---

## Unused Dependencies

The following packages are listed in `package.json` but are not actively used in the source code:

| Package | Status |
|---------|--------|
| `@heroicons/react` | Imported in package.json, not used in source |
| `bootstrap` | Listed as dependency, not used (Tailwind is primary) |
| `src/utils/maked.js` | Empty file (0 bytes); `ChatAndSettings.tsx` imports `marked` directly |

---

## Test Coverage Gaps

The E2E tests (`tests/e2e/screenshot.spec.ts`) only capture screenshots of the Settings and Chat screens. The following flows have no automated test coverage:

- Sending a message and receiving a response
- Settings persistence across page reload
- Session create/load/delete
- Dark mode and language toggle
- Minimap interaction
- Reasoning model detection
- Provider-specific API request routing

<!-- commit: 057f5ca89b705c95d2d9ef96bafa25aa06a40056 -->
