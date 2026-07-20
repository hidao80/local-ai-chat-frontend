---
name: analyzed-security
description: OWASP-aligned security audit covering all major categories for this client-only SPA.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Security

## Table of Contents

- [Scope & Baseline](#scope--baseline)
- [Findings by Severity](#findings-by-severity)
- [OWASP Top 10 Coverage Matrix](#owasp-top-10-coverage-matrix)
- [Supply Chain](#supply-chain)

---

## Scope & Baseline

Client-only React SPA, no backend (per [[databases]], `.claude/rules/security.md`). Threat model is: malicious/compromised LLM responses, a hostile or misconfigured user-supplied endpoint, and browser-origin attacks (XSS, storage exposure). Server-side categories (auth, injection into a DB, SSRF-to-internal-network-from-server) largely do not apply because there is no server component other than static file hosting.

This is a **report only** — no fixes were applied. Findings are ranked most-severe first per repository audit convention.

---

## Findings by Severity

### Medium

**M1. Unsanitized Markdown → `dangerouslySetInnerHTML` (XSS)**
`Chat` renders `marked.parse(message.content)` directly into the DOM. Since message content includes both the user's own input and the LLM's response, a prompt-injection-style attack that gets the model to echo back `<img src=x onerror=...>` or similar would execute in the page. No CSP is configured (`index.html` has no `Content-Security-Policy` meta tag) to mitigate as defense-in-depth.
→ Same as [[known_bugs]] #1. Recommend: ★4 — add DOMPurify sanitization pass before rendering.

**M2. API Keys Stored Unencrypted in IndexedDB**
`config.apiKey` is persisted as plaintext in the `ai-chat-config` IndexedDB store (see [[databases]]). This is consistent with the project's explicit design decision (`.claude/rules/security.md`: "IndexedDB is the single source of truth," no backend to delegate secret storage to) — flagging as a residual risk rather than a defect: any other JS executing in this origin (e.g., via the XSS above) can read the key via `indexedDB.open(...)`.
→ Recommend: ★2 — mitigating M1 substantially reduces this risk's practical exploitability; encrypting at rest would need a user-supplied passphrase (added UX friction) so is not free.

### Low

**L1. No Content-Security-Policy**
`index.html` sets no CSP header/meta tag. Would provide defense-in-depth against M1 (e.g., blocking inline `onerror` handlers or restricting script-src).

**L2. Open CORS Recommended for Local Providers**
README instructs users to run `OLLAMA_ORIGINS=*` and enable CORS broadly on LM Studio/llama.cpp. This is a documented, user-opted-in local-network tradeoff (per `.claude/rules/security.md`: "Do not sanitize or restrict [user-supplied endpoints]... users intentionally point to local/remote LLM servers"), not an app-level vulnerability — noted for completeness since it widens the attack surface of the *provider*, not this app.

**L3. `sirv-cli --cors` Always Enabled in Production**
`bin/start.js` always passes `--cors`, per `.claude/rules/security.md` this is intentional (allows the SPA's own static assets to be fetched cross-origin). Confirmed no credentials or session cookies are involved, so blanket CORS on the static server itself carries low risk.

**L4. No Subresource Integrity / Pinning Beyond Lockfile**
Dependencies are pinned via `pnpm-lock.yaml` and gated by `min-release-age=7` + Takumi Guard scanning in CI (see [[infrastructure]], [[dependencies]]), but there's no additional runtime integrity check (e.g., SRI hashes) since everything is bundled at build time — standard for a Vite SPA, noted as a baseline fact not a gap.

### Info

**I1. `eval()` / `new Function()`**: Confirmed absent from `src/` — no dynamic code execution of LLM output, per `.claude/rules/security.md` requirement.

**I2. Authorization header conditional-send pattern**: Confirmed correctly implemented — `Authorization: Bearer` is only added when `config.apiKey` is non-empty, in both `Settings`' model-fetch and `Chat`'s `sendMessage()`, matching `.claude/rules/security.md`.

**I3. No secrets in source/config**: Confirmed — `vite.config.ts`, `Dockerfile`, `docker-compose.yml`, CI workflows contain no hardcoded credentials. No `VITE_*` env vars are defined.

---

## OWASP Top 10 Coverage Matrix

| Category | Applicable? | Status |
|---|---|---|
| A01 Broken Access Control | No backend → N/A | — |
| A02 Cryptographic Failures | Partial | M2 (plaintext API key at rest) |
| A03 Injection | Yes (XSS via DOM, not SQL) | M1 |
| A04 Insecure Design | Yes | L2 (documented tradeoff, see [[security]] rules) |
| A05 Security Misconfiguration | Yes | L1, L3 |
| A06 Vulnerable/Outdated Components | Yes | Clean — see [[dependencies]] (0 advisories) |
| A07 Auth Failures | No app-level auth → N/A | — |
| A08 Software/Data Integrity Failures | Yes | Mitigated — Takumi Guard + `min-release-age` (see [[infrastructure]]) |
| A09 Logging/Monitoring Failures | No server → N/A | — |
| A10 SSRF | Intentional by design | L2, per `.claude/rules/security.md` explicit exemption |

## Supply Chain

Covered in depth in [[dependencies]] and [[infrastructure]]: `pnpm audit` clean (306 packages), Takumi Guard malware/typosquat scanning in `lint.yml` + `audit.yml`, `min-release-age=7` cool-down on new package versions, `ignore-scripts=true` blocking arbitrary install-time code except an explicit `esbuild` allowlist.

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
