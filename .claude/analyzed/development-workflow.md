---
name: analyzed-development-workflow
description: Local development, build, lint, and release workflow.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Development Workflow

## Table of Contents

- [Local Setup](#local-setup)
- [Daily Commands](#daily-commands)
- [Verification Before Completion](#verification-before-completion)
- [Release / Distribution](#release--distribution)
- [CI Gate](#ci-gate)

---

## Local Setup

```bash
pnpm install
pnpm dev          # http://localhost:5173, GPT4ALL proxy active
```

## Daily Commands

| Command | Effect |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | `tsc -b && vite build` → `dist/` |
| `pnpm lint` | `biome lint` |
| `pnpm format` | `biome format` |
| `pnpm exec tsc --noEmit` | Type-check only |
| `pnpm preview` | Serve built `dist/` via Vite |
| `pnpm start` | `node bin/start.js` (sirv-cli, production mode) |
| `pnpm test:e2e` / `:ui` / `:headed` | Playwright suites |
| `pnpm screenshot` | Screenshot spec only |
| `pnpm act` / `act:audit` / `act:build` / `act:lint` | Run GitHub Actions workflows locally via `act` + Podman (see [[infrastructure]]) |

## Verification Before Completion

Per project rule (`.claude/rules/code-style.md`): after any edit, run `pnpm exec tsc --noEmit` then `pnpm build` and confirm zero errors before considering a change done.

## Release / Distribution

- `package.json` `files: ["bin", "dist"]` + `bin.local-ai-chat-frontend: ./bin/start.js` — package is consumable via `npx github:hidao80/local-ai-chat-frontend` or `pnpm dlx ...` without a registry publish (Factual: no `publishConfig` or npm publish workflow found).
- `prepare` and `prepack` scripts both run `pnpm build`, ensuring `dist/` exists before the package is used via `npx`/`dlx` from a git reference.

## CI Gate

Three workflows gate every push to `main`/`develop` (see [[infrastructure]] for full detail):

1. `lint.yml` — Takumi Guard scan → `biome ci .`
2. `audit.yml` — `pnpm audit --audit-level=high` (separate job also runs a scan-only install)
3. `build.yml` — `docker build` (image built, not pushed)

No workflow currently runs `pnpm exec tsc --noEmit`, `pnpm build` (non-Docker), or the Playwright E2E suite in CI — these checks are asserted only via local developer discipline (`.claude/rules/code-style.md`) and are not automatically enforced. See [[todo]].

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
