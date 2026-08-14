---
name: analyzed-adr
description: Architecture Decision Records derived from the project's git history.
type: analysis
---

# Architecture Decision Records (ADR)

Generated from `git log` (full history, 2026-02-08 → 2026-08-14). Each record groups related commits around one architectural decision. Status reflects the state as of the latest commit (`95f7eb3`), not necessarily the original intent.

---

## ADR-001: No backend — browser-only persistence and direct LLM fetch

**Date**: 2026-02-08 (initial commit `1e72af4` onward)
**Status**: Accepted

**Context**: The app needs to talk to local and remote LLM servers (OpenAI, LM Studio, GPT4ALL, Ollama, llama.cpp) without operating any server-side component of its own.

**Decision**: All state (config, chat history, system prompts) is persisted client-side in IndexedDB (`ai-chat-config`). All LLM calls go straight from the browser via `fetch()` to a user-supplied endpoint. There is no proxy or API layer in production.

**Consequences**: Zero backend to deploy or secure server-side, but CORS becomes the user's problem (see ADR-003 for the dev-only GPT4ALL proxy exception), and API keys live in the browser (IndexedDB), never sent anywhere but the configured endpoint.

---

## ADR-002: Single-page app with boolean navigation, no router

**Date**: 2026-02-08 onward
**Status**: Accepted

**Context**: The app has exactly two screens (Settings, Chat).

**Decision**: `App.tsx` holds one `showSettings` boolean and conditionally renders `<Settings>` or `<Chat>`. No router library (react-router, etc.) was introduced.

**Consequences**: Minimal dependency footprint; no URL-addressable state. Acceptable while the screen count stays at two — revisit if deep-linking or more screens are ever needed.

---

## ADR-003: Multi-provider LLM support via direct fetch, no shared abstraction layer

**Date**: 2026-02-08 (`d18b54f`, `076a4ec`, `132c9cb`)
**Status**: Accepted

**Context**: Support was added incrementally for five providers: OpenAI, LM Studio, GPT4ALL, Ollama, and llama.cpp (`132c9cb` :sparkles: "Add llama.cpp provider support with reasoning_effort"), each with slightly different request/response shapes (e.g. Ollama's `think` param, llama.cpp's `reasoning_effort`).

**Decision**: Per-model system prompts and per-provider request handling live directly in `ChatAndSettings.tsx` (`d18b54f` :sparkles: "Add per-model system prompts, copy feature, and GPT4ALL proxy") rather than behind a provider-abstraction interface. GPT4ALL is proxied through Vite (`/api/gpt4all` → `http://localhost:4891`) in dev only, to work around CORS; other providers are called directly.

**Consequences**: Adding a 6th provider means another branch in `ChatAndSettings.tsx`, not a new class behind an interface — acceptable at 5 providers, worth revisiting only if the branching grows unwieldy.

**Update (2026-07-20, `be8b032` "fix: update API endpoint in Settings component and adjust model reasoning check")**: The Ollama model-detail fetch (`Settings`) was changed from a hardcoded `/api/ollama/api/show` path (a dev-proxy route that was never actually configured in `vite.config.ts` and 404'd in any environment) to a direct `${config.endpoint}/api/show` call, matching the pattern already used for `/api/tags`. Separately, the Reasoning Effort selector's visibility condition gained `&& config.provider !== "gpt4all"`, since GPT4ALL doesn't support the `reasoning_effort`/`think` params (see [[known_bugs]] — this was independently found and fixed via the same route earlier in this session before the commit was discovered in history).

---

## ADR-004: Replace PWA with sirv-cli for npx/pnpm-dlx distribution

**Update (2026-08-14)**: The package manager itself moved from pnpm to bun — see ADR-012. The zero-install distribution model this ADR describes is unchanged; only the underlying tool invoked by `npx`/`bunx` differs.

**Date**: 2026-02-08 → 2026-02-09 (`7b6d374`, `0dfab71`, `43938c6`, `15a2d42`, `568713d`, `34d14e9`)
**Status**: Accepted

**Context**: The project originally shipped as a PWA (service worker + manifest). The goal shifted to distributing the app as a zero-install CLI tool runnable via `npx`/`pnpm dlx`.

**Decision**: `7b6d374` (:zap:) removed the PWA approach and introduced `sirv-cli` as the static file server, invoked through `bin/start.js`. Follow-up commits fixed the binary resolution (`43938c6` :bug:), added a `prepare` script to auto-build `dist/` on install-from-GitHub (`15a2d42` :wrench:), and added `--ignore-scripts` to the Dockerfile's `pnpm install` so `prepare` doesn't run before sources are copied (`568713d` :whale:). `0639b221` (:fire:) later cleaned up leftover service-worker references from Dockerfile/`.htaccess`.

**Consequences**: Simpler distribution model (one `pnpm dlx local-ai-chat-frontend` command) but no offline/installable-app capability. The package was also renamed `chat-fe` → `local-ai-chat-frontend` (`0dfab71` :package:, `11396258` :pencil2:) to match this distribution model.

---

## ADR-005: Biome as the sole linter/formatter, replacing ESLint/Prettier

**Date**: 2026-03-05 (`9246c78`, `7300ec7`, `5f936fa`)
**Status**: Accepted

**Context**: The project needed a lint/format toolchain alongside the new Playwright E2E setup (ADR-006).

**Decision**: `9246c78` (:wrench: "Add Biome and Playwright, update dockerignore and lockfile") introduced Biome. `7300ec7` (:art:) configured Biome v2 and reformatted all source files in one pass. `5f936fa` (:arrow_up:) upgraded Biome v1.9 → v2.4.5 shortly after.

**Consequences**: One tool covers both lint and format (`pnpm lint`, `pnpm format`), replacing the ESLint+Prettier combo. `biome.json` scopes to `src/` and `tests/`; `dist/` is excluded.

**Update (2026-07-20, `98198a2` "fix: update biome schema version and adjust linter rules")**: Bumped `$schema` from `2.4.5` → `2.5.4` and migrated the linter config key from the deprecated `"recommended": true` shorthand to `"preset": "recommended"`. Note that a separate ESLint flat config (`eslint.config.js`) still exists in the repo but remains unwired to any script or CI job — see [[known_bugs]] #10.

---

## ADR-006: Playwright for E2E/screenshot testing

**Date**: 2026-03-05 (`e959d3a`)
**Status**: Accepted

**Context**: No automated UI testing existed before this point.

**Decision**: `e959d3a` (:white_check_mark: "Add Playwright E2E tests and migrate linter to Biome") added Playwright alongside the Biome migration, with a screenshot spec under `tests/e2e/`.

**Consequences**: `pnpm test:e2e`, `pnpm test:e2e:ui`, and `pnpm screenshot` became part of the standard command set. Coverage is screenshot/E2E only — no unit test framework has been introduced.

---

## ADR-007: pnpm workspace overrides for esbuild security patching (volatile)

**Date**: 2026-03-05 → 2026-06-13 (`7e5715d`, `3c83095`, `0c74d4a`, `2c2b8ac`, `dcc6df1`)
**Status**: Superseded (in flux — see note)

**Context**: A vulnerable transitive `esbuild` dependency needed patching.

**Decision history** (the record of a decision that was tried, reverted, and retried):
1. `7e5715d` (:lock:) added pnpm overrides to patch the vulnerable transitive dependency.
2. `3c83095` (:rewind:) reverted this — removed the `pnpm-workspace.yaml` overrides and reverted the lockfile.
3. Months later, `0c74d4a` re-added pnpm workspace configuration specifically to *allow* esbuild builds (i.e., permit its postinstall/build script under pnpm's default script-blocking).
4. `2c2b8ac` updated the esbuild version and added overrides again in the workspace config.
5. `dcc6df1` then removed the "minimum release age" exclusions and overrides from that same workspace config.

**Consequences**: This override configuration has changed direction multiple times and should be treated as unstable — check `pnpm-workspace.yaml` directly for the current state rather than trusting any single past commit here.

**Update (2026-08-14, `6ce9ea7` "fix: update package manager to bun and adjust build scripts")**: The `allowBuilds: esbuild: true` entry was removed from `pnpm-workspace.yaml` as part of the pnpm-to-bun migration (ADR-012). The file itself was not deleted and is now dead weight — pnpm is no longer the project's package manager, so this file should be removed entirely rather than edited further.

---

## ADR-008: `.npmrc` install-script and release-age policy

**Date**: 2026-03-05 → 2026-04-04 (`9fc674a`, `5c60a0f`)
**Status**: Accepted

**Context**: Paired with ADR-007's esbuild concerns, install-time script execution needed a policy.

**Decision**: `9fc674a` (:wrench:) simplified `.npmrc` to pnpm defaults, keeping `strict-peer-dependencies=false`. `5c60a0f` later updated `.npmrc` to ignore install scripts and set a minimum release age (a supply-chain-hardening measure — delays picking up freshly-published, potentially-compromised package versions).

**Consequences**: Reduces exposure to malicious postinstall scripts and just-published/compromised packages, at the cost of needing explicit opt-in (ADR-007's workspace overrides) for packages like esbuild that require their install script to function.

---

## ADR-009: CI/CD workflow separation and hardening

**Date**: 2026-02-09 → 2026-06-13 (`732e30d`, `d98bfdc`, `3d3ed88`/`2df4fe0`/`4389a04`, `ad9e993`, `84f6c8c`, `9fe8585`, `d450b08`)
**Status**: Accepted

**Context**: CI needed to build a Docker image, lint the code, and audit dependencies, while working within an internal registry proxy ("takumi-guard") that doesn't support `pnpm audit` directly.

**Decision**: `732e30d` (:construction_worker: "Modernize CI workflows and update project docs") established the current three-workflow split: `build.yml`, `lint.yml`, `audit.yml`. `d98bfdc` (:green_heart:) upgraded `actions/checkout` to v5, added a `develop` branch trigger, and switched linting to run through reviewdog. `ad9e993` removed a `pnpm audit` step because it was incompatible with the takumi-guard registry proxy, and `3d3ed88`/`2df4fe0`/`4389a04` added an npm advisory audit job as a separate, compatible replacement. `84f6c8c` and `9fe8585` bumped Node to v24 in the audit workflow and Dockerfile base image respectively. `d450b08` added `.actrc` config and installed the Docker CLI in the build workflow (for local `act`-based CI testing).

**Consequences**: Dependency auditing runs via a registry-proxy-compatible path rather than native `pnpm audit`; keep this in mind if `pnpm audit` mysteriously fails in CI — it's expected, not a regression.

**Update (2026-07-20, `98198a2`)**: Added `act`, `act:audit`, `act:build`, `act:lint` scripts to `package.json`, giving each CI job a matching local-emulation command via `.actrc` (see [[infrastructure]]) and `act`/Podman (ADR context: `d450b08` had already added `.actrc` and Docker-CLI-for-act support). Also added `test:e2e:headed` as a new Playwright script alongside these.

**Update (2026-07-20, `1e98095` "fix: update GitHub Actions to use latest versions of checkout, pnpm, and setup-node")**: Bumped pinned Action versions across all three workflows — `actions/checkout` → v6, `pnpm/action-setup` → v6, `actions/setup-node` → v7 (in `audit.yml`), plus adjustments to `lint.yml`'s step structure. Routine dependency-currency maintenance, no behavioral change to what each workflow does.

**Update (2026-08-14, `8b2a247` "fix: update actions/checkout version to v7 in workflow files")**: `actions/checkout` bumped to v7 across all three workflows. `audit.yml`'s `pnpm/action-setup` + `actions/setup-node` steps were replaced with `oven-sh/setup-bun@v2`, and both jobs now run `bun install --frozen-lockfile` / `bun audit --audit-level=high` instead of the pnpm equivalents — part of the pnpm-to-bun migration (ADR-012).

---

## ADR-010: Documentation restructuring and relocation

**Date**: 2026-03-13 → 2026-03-18 (`6d650e9`, `493b7ee`, `76a83b1`, `ebd5b0f`, `4b3a964`, `31b37f5`, `c59a5dd`, `9798a0a`)
**Status**: Accepted

**Context**: Project docs and AI-assistant configuration needed a stable, discoverable home as the project grew.

**Decision**: Docs started at `docs/spec/` (`6d650e9`). `CLAUDE.md` moved to `.claude/` with Podman instructions added to the README (`493b7ee` :memo:), then to `.claude/rules/` alongside new Gemini/Codex configs (`4b3a964`). Git tracking was tightened to include `.claude/rules` and `CLAUDE.md` while ignoring only local history files (`31b37f5`), and `.claude/settings.local.json` was excluded (`c59a5dd`). `76a83b1` (:memo:) restructured the AI-agent docs and migrated `docs/spec` → `docs/analyzed`, the layout now referenced throughout `.claude/CLAUDE.md`. `9798a0a` (:gear:) configured Codex to load `CLAUDE.md` as project docs, and `ebd5b0f` added the initial CLAUDE.md and Claude Code rule files.

**Consequences**: Current canonical locations are `.claude/CLAUDE.md` (main instructions) and `docs/analyzed/*.md` (component/screen/db/utility/overview docs) — don't recreate `docs/spec/`, it was deliberately superseded.

**Status change (2026-08-14): Superseded by ADR-013.** The `.claude/analyzed/*.md` migration mentioned below did happen, but was then reversed the same day — see ADR-013 for the current (much simpler) documentation layout.

**Historical note**: A further migration moved `docs/analyzed/*.md` → `.claude/analyzed/*.md` (this file's own directory), with `docs/analyzed/` deleted and `.claude/CLAUDE.md`'s workflow references repointed accordingly.

---

## ADR-011: `dist/` build-artifact tracking policy (unstable)

**Date**: 2026-03-13, then 2026-06-13 (`057f5ca`, `741e161`, `0e1b1b0`, `a52858b`, `251328e`)
**Status**: Superseded (in flux — see note)

**Context**: `dist/` is Vite's build output. Whether to commit it is in tension with `bin/start.js`'s need to serve *something* for users who install via `pnpm dlx` from a git ref rather than a published npm tarball (where `prepare` runs `pnpm build` on install, per ADR-004).

**Decision history**:
1. `057f5ca` (2026-03-13) added `dist/` to `.gitignore` and removed tracked build artifacts — the "don't commit `dist/`" position, matching `docs/analyzed/overview.md`'s note "Build output (do not commit manually)".
2. `a52858b` (2026-06-13, 12:36) re-added `dist/index.html`, `dist/favicon.png`, and built JS/CSS assets directly to the repo, editing `.gitignore` to allow it.
3. `741e161` (2026-06-13, 12:41) followed up, further adjusting `.gitignore` to include `dist/` and adding a `prepare` script to `package.json`.
4. `0e1b1b0` (2026-06-13, 12:42) reversed course again, removing the favicon and `index.html` from `dist/`.
5. `251328e` (2026-06-13, 14:15) re-added the same `dist/` files a third time — `dist/index.html`, `dist/favicon.png`, and built assets were tracked in git as of that commit.
6. `aac5c0f` (2026-07-20) — labeled "Refactor code structure for improved readability and maintainability" but its actual diff only deletes `dist/assets/index-B4z3HPQR.css` and `dist/assets/index-BxL49gm8.js` (70 lines removed, no source files touched). **Mislabeled commit message** — the content is a partial reversal back toward "don't commit built assets," not a refactor. `dist/index.html` and `dist/favicon.png` were not touched by this commit, so `dist/` tracking is now in a mixed state (HTML/favicon tracked, JS/CSS assets not).

**Consequences**: This has oscillated across a full day and contradicts the "do not commit manually" guidance that was present in the now-migrated `docs/analyzed/overview.md` (see [[notes]] for the doc migration). Treat `dist/` tracking as unresolved — check `.gitignore` and `git ls-files dist/` directly before assuming either policy. Also note commit message accuracy has degraded here (`aac5c0f`'s message doesn't describe its actual change) — verify diffs directly rather than trusting subject lines for this file's history.

---

## ADR-012: Migrate package manager from pnpm to bun

**Date**: 2026-08-14 (`f7061c0`, `6ce9ea7`, `9cd1fdd`, `253a0be`, `d68a159`, `8b2a247`, `95f7eb3`)
**Status**: Accepted

**Context**: The project had used pnpm since its early commits (ADR-007, ADR-008). The `packageManager` field, lockfile, CI workflows, Docker build, and every doc that told a contributor how to install/build/run the project were all pnpm-specific.

**Decision**: Switched the package manager to bun across the whole repo in a single day:
- `package.json`: `packageManager` → `bun@1.2.20`; `prepare`/`prepack` scripts → `bun run build` (`6ce9ea7`).
- Lockfile swapped: `pnpm-lock.yaml` removed, `bun.lock` committed (`f7061c0`).
- `Dockerfile` and `docker-compose.yml` build/run steps switched to `bun install` / `bun run …` (`253a0be`).
- `playwright.config.ts`'s `webServer.command` switched from `pnpm run dev` to `bun run dev` (`d68a159`).
- `.github/workflows/audit.yml` replaced `pnpm/action-setup` + `actions/setup-node` with `oven-sh/setup-bun@v2`, and its steps now run `bun install --frozen-lockfile` / `bun audit --audit-level=high` (`8b2a247`, see ADR-009 update).
- `.gitignore` / `.dockerignore`: `pnpm-debug.log*` → `bun-debug.log*`, `.pnpm-store` → `.bun` (`9cd1fdd`).
- `README.md` install/dev/build commands rewritten from `pnpm` to `npx`/`bunx`/`bun run` equivalents (`95f7eb3`).

Two unused, unreferenced source files (`src/App.css`, `src/utils/maked.js` — both already empty) and an unreferenced asset (`src/assets/react.svg`) were deleted in the same commit as the lockfile swap (`f7061c0`), unrelated to the package-manager change itself but bundled into the same cleanup pass.

**Consequences**: `pnpm-workspace.yaml` (see ADR-007 update) is now dead weight and should be deleted in a follow-up — it wasn't removed as part of this migration. Anyone still invoking `pnpm install`/`pnpm run …` locally will hit a `packageManager`-mismatch error from corepack; the correct commands are documented in `AGENTS.md` and `README.md`.

---

## ADR-013: Consolidate AI-agent docs into `AGENTS.md`; drop `.claude/analyzed/`, `.claude/rules/`, `.codex/`, `.gemini/`

**Date**: 2026-08-14 (`6ce9ea7`, `0fd9671`, `01d8c59`)
**Status**: Accepted (supersedes ADR-010's `.claude/analyzed/` layout)

**Context**: ADR-010 had built up a layered docs structure — `.claude/CLAUDE.md` plus `.claude/rules/{code-style,commands,security}.md` plus 19 files under `.claude/analyzed/` — alongside separate `.codex/config.toml` and `.gemini/GEMINI.md` configs for other AI tools. This had grown large and duplicative, and `.claude/CLAUDE.md` itself had drifted out of sync with the actual repo layout (referencing files/dirs that no longer matched reality).

**Decision**: Deleted the whole layered structure in favor of one file: `.claude/CLAUDE.md` was removed (`6ce9ea7`); all 19 `.claude/analyzed/*.md` files plus the three `.claude/rules/*.md` files were removed (`0fd9671`); `.codex/config.toml` and `.gemini/GEMINI.md` were removed (`01d8c59`). `AGENTS.md` was rewritten to be self-contained — it now directly states the project overview, key files, commands, code style, and security guidance that used to live across the deleted `.claude/rules/*.md` files, rather than pointing to them by reference. A root-level `CLAUDE.md` was added containing a single `@AGENTS.md` import, so tools that specifically look for `CLAUDE.md` still resolve to the same content (`01d8c59`).

**Consequences**: One canonical instructions file (`AGENTS.md`) instead of five-plus scattered ones — lower risk of the docs drifting out of sync with the repo the way `.claude/CLAUDE.md` had. This directly supersedes ADR-010's "current canonical locations" note. If per-topic rule files are reintroduced later, keep them referenced from `AGENTS.md` rather than letting `AGENTS.md` and the rule files describe the repo independently, which is what caused this rewrite.

---

## ADR-014: Landing page hardening — social metadata, style guide, editor config

**Date**: 2026-08-14 (`f50b378`, `7500294`, `e8db5cc`, `82e8289`)
**Status**: Accepted

**Context**: Several small, independent polish items landed the same day as the pnpm→bun migration and doc consolidation (ADR-012, ADR-013).

**Decision**:
- `.editorconfig` added, matching Biome's existing 2-space/no-tabs convention (`f50b378`).
- `docs/DESIGN.md` added, documenting Biome/TypeScript/React/component-structure code style guidelines (`e8db5cc`).
- Four Claude Code slash-command docs added under `.claude/commands/`: `code-analyze.md`, `make-lp.md`, `make-social-preview.md`, `update-adr.md` (this ADR file is itself generated by the last of these) (`7500294`).
- `docs/index.html` gained a `social-preview.png` Open Graph/Twitter Card image plus expanded meta tags (`82e8289`).

**Consequences**: These are additive, low-risk changes with no architectural coupling to the app itself — grouped here as one ADR because they're same-day polish, not because they share a rationale.

---

## Summary table

| ADR | Decision | Status |
|-----|----------|--------|
| 001 | No backend; IndexedDB + direct fetch | Accepted |
| 002 | Boolean nav, no router | Accepted |
| 003 | Direct per-provider fetch, no abstraction layer | Accepted |
| 004 | PWA → sirv-cli for npx/pnpm-dlx distribution | Accepted |
| 005 | Biome replaces ESLint/Prettier | Accepted |
| 006 | Playwright for E2E/screenshots | Accepted |
| 007 | pnpm overrides for esbuild security patch | Superseded / volatile |
| 008 | `.npmrc` ignore-scripts + min release age | Accepted |
| 009 | Split CI into build/lint/audit workflows | Accepted |
| 010 | Docs moved to `.claude/` + `docs/analyzed/` | Superseded by 013 |
| 011 | `dist/` tracked in git | Superseded / volatile |
| 012 | Package manager: pnpm → bun | Accepted |
| 013 | Consolidate AI-agent docs into `AGENTS.md` | Accepted |
| 014 | Landing page hardening (OGP, DESIGN.md, editorconfig) | Accepted |
