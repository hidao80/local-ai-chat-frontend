---
name: analyzed-known-bugs
description: Catalog of known bugs, architectural/design issues, compatibility issues, and analytical limitations.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Known Bugs & Issues

## Table of Contents

- [Security Issues](#security-issues)
- [Architectural/Design Issues](#architecturaldesign-issues)
- [Compatibility Issues](#compatibility-issues)
- [Documentation/Config Mismatches](#documentationconfig-mismatches)
- [Notes on Analytical Limitations](#notes-on-analytical-limitations)

---

## Security Issues

### 1. ~~XSS via Markdown Rendering~~ (Fixed)

**Severity**: Medium · **Location**: `Chat` message rendering, `ChatAndSettings.tsx`

**Status: Fixed** — `marked.parse()` output is now passed through `DOMPurify.sanitize()` before `dangerouslySetInnerHTML`. `dompurify` added as a runtime dependency. See [[security]], [[utilities]].

---

## Architectural/Design Issues

### 2. No Response Streaming

**Severity**: Low (UX) · **Location**: `sendMessage()` in `Chat`

Full response is awaited before any output is shown; no SSE/`ReadableStream` incremental parsing. See [[performance]].

### 3. All Chat Sessions Loaded into Memory

**Severity**: Low (performance) · **Location**: `loadAllChatSessions()` call sites

No pagination; all sessions load into state on mount and after every write. See [[performance]], [[databases]].

### 4. GPT4ALL Only Proxied in Dev

**Severity**: Medium · **Location**: `vite.config.ts`, `sendMessage()`/model-fetch in `Chat`/`Settings`

GPT4ALL requests are hardcoded to the literal path `/api/gpt4all/...`, which only resolves via Vite's dev-only `server.proxy`. In any static-serving deployment (Docker/nginx, sirv, or Apache/Laragon serving `dist/`), this path does not exist server-side and 404s. **Confirmed live in this session**: Apache2 (Laragon) serving `dist/` returned 404 for `/api/gpt4all/v1/models`.

**Workaround**: Add an equivalent reverse-proxy rule on the serving layer (e.g., Apache `ProxyPass /api/gpt4all/ http://localhost:4891/`), or run via `docker compose up` for dev. Production use of GPT4ALL through the static build is otherwise unsupported. See [[infrastructure]], [[todo]].

### 5. Reasoning Model Detection is Heuristic

**Severity**: Low · **Location**: `isReasoningModel()`

Pattern-matches model names (`o1`, `reasoning`, `gpt-oss`, `deepseek-r1`) — models with other names won't show the reasoning-effort selector even if they support it.

### 6. Session Title Uses Raw Message Content

**Severity**: Low · **Location**: `ChatSidebar` session list

Title = first 50 chars of first user message verbatim, including any Markdown syntax/special characters.

### 7. `createdAt` Is Overwritten on Every Save

**Severity**: Low · **Location**: `Chat`'s message-persistence `useEffect`

Each save reconstructs `ChatSession` with `createdAt: Date.now()`, so a session's original creation time is lost after the second message — `createdAt` effectively always equals the most recent save time, duplicating `updatedAt`. See [[databases]].

**Recommended fix**: Preserve `createdAt` from the existing session record (fetch-then-merge, or track it in component state separately from `messages`).

### 8. Ollama Model-Detail Fetch Has No Concurrency Cap

**Severity**: Low · **Location**: `Settings`'s model-fetch effect

`Promise.all` fires one `/api/show` request per model with no batching/throttle. See [[performance]].

---

## Compatibility Issues

### 9. ~~`globals` Resolved Version Mismatch~~ (Fixed)

**Status: Fixed** — `globals` was an ESLint-only transitive dependency; removed along with ESLint itself (see #10).

### 10. ~~Two Linters, One Wired to CI~~ (Fixed)

**Status: Fixed** — `eslint.config.js` and all ESLint devDependencies (`eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `globals`) removed. Verified Biome 2.5.4's `lint/correctness/useExhaustiveDependencies` (recommended preset) catches the same class of bugs ESLint's `react-hooks/exhaustive-deps` did — confirmed via a throwaway test file before removal. Biome is now the sole lint/format tool. See [[configurations]], [[dependencies]].

**Separately discovered while investigating this**: `biome.json`'s `files.includes` used a malformed glob (`["src", "tests", "!!/dist"]`) that matched zero files under Biome 2.5.4 — `src/` and `tests/` had **never actually been linted**. Fixed to `["src/**", "tests/**", "!dist", "!src/index.css"]` (the `index.css` exclusion works around Biome 2.5.4's CSS parser not yet supporting Tailwind v4's parenthesized `@variant` syntax). Running the corrected config surfaced 29 previously-invisible errors (a11y `useButtonType`/interactive-div issues, a `noNonNullAssertion`, `noArrayIndexKey`, and the XSS finding above) — all fixed in this pass. Also discovered `@biomejs/biome` CLI (`2.4.16`) didn't match `biome.json`'s `$schema` (`2.5.4`) and its `"preset": "recommended"` syntax, causing the CLI to hard-fail on any direct invocation; upgraded the dependency to `^2.5.4` to match.

---

## Documentation/Config Mismatches

### 11. LM Studio Default Endpoint Mismatch

**Severity**: Low · **Location**: `README.md` vs `ChatAndSettings.tsx`

README states LM Studio's default endpoint as `http://localhost:12345`; the code's `defaultEndpoints` map uses `http://localhost:1234`. One of the two is wrong — **Unconfirmed** which is authoritative (LM Studio's actual default server port is `1234`, suggesting the README has a typo).

### 12. `.gitignore` Comments Out `dist/` Despite Commit History Claiming Otherwise

**Severity**: Low · **Location**: `.gitignore`

Current content has `# dist/` (commented out) even though commit `741e161` is titled "fix: update .gitignore to include dist/ directory". `dist/` is therefore **not** ignored by that line (though `dist-ssr` and other patterns remain active) — **Unconfirmed** whether this is intentional (e.g., superseded by a later change) or a regression.

### 13. `LICENSE` File Referenced but Missing

**Severity**: Low · **Location**: `README.md`

README links to `[LICENSE](LICENSE)` and states MIT, but no `LICENSE` file exists in the repository root (`ls LICENSE*` returns nothing).

---

## Notes on Analytical Limitations

- No runtime profiling, Lighthouse audit, or load testing was performed — [[performance]] entries are static-analysis-derived candidates only.
- Vulnerability scan (`pnpm audit`) reflects a single point-in-time snapshot at commit `1e98095` — see [[dependencies]].
- No access to `.claude/settings.local.json` (gitignored) — any local-only permission/hook config is outside this analysis's scope.

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
