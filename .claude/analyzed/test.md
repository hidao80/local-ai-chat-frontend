---
name: analyzed-test
description: Existing E2E test suite content and coverage.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Test

## Table of Contents

- [Test Stack](#test-stack)
- [Existing Tests](#existing-tests)
- [Coverage Gaps](#coverage-gaps)

---

## Test Stack

Playwright (`@playwright/test` 1.60.0), config in `playwright.config.ts` (see [[configurations]]). No unit test framework (e.g., Vitest) is configured — `package.json` has no `test` script beyond the `test:e2e*` family.

Projects run against Chromium only, at three viewports: `mobile` (375×812), `tablet` (768×1024), `fhd` (1920×1080).

## Existing Tests

`tests/e2e/screenshot.spec.ts` — `describe("Full-Page Screenshot Tests")`, 2 tests:

| Test | Steps | Assertion |
|---|---|---|
| `capture settings screen` | `goto("/")` → wait for `networkidle` → screenshot to `screenshots/settings-{project}.png` | `expect(page).toHaveTitle(/.+/)` (any non-empty title) |
| `capture chat screen` | `goto("/")` → wait `networkidle` → click button matching `/chat/i` if visible → screenshot to `screenshots/chat-{project}.png` | Same title assertion |

Both tests run × 3 viewport projects = 6 total test executions. These are **visual smoke tests only** — they assert page title is non-empty, not that any specific UI content, provider logic, or interaction behaves correctly.

## Coverage Gaps

No automated test exists for:

- Sending a message and receiving a response (any provider)
- Settings persistence across page reload (IndexedDB round-trip)
- Session create/load/delete flow
- Dark mode and language toggle
- Minimap interaction (click-to-scroll)
- Reasoning model detection (`isReasoningModel`)
- Provider-specific API request routing/body construction
- Any unit-level test of pure functions (`isReasoningModel`, IndexedDB helpers) — no unit test runner is set up at all

See [[todo]] for proposed test additions.

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
