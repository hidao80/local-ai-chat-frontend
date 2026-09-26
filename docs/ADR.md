---
name: analyzed-adr
description: Architecture Decision Records derived from the project's git history.
type: analysis
commit-hash: a8f57103e1e73d5369729a5d1be8103672d86194
---

# Architecture Decision Records (ADR)

Generated from `git log` (full history, 2026-02-08 → 2026-09-26). Each record groups related commits around one architectural decision. Status reflects the state as of the latest commit (`a8f5710`), not necessarily the original intent. Records 001-016 are carried over from `docs/ADR.md` (which covers history up to `a6c3a58`); later changes appear as dated **Update** notes and as ADR-017 onward.

**Working-tree note (not in any commit at generation time):** `bin/start.js` (sirv + Node `http` server with security headers, shell-less build, `PORT`/`HOST` validation), the new `bin/security-headers.json`, and edits to `docs/DESIGN.md` and `docs/index.html` exist only in the working tree. The committed `HEAD` therefore still has `bin/start.js` spawning `npx sirv-cli` while `package.json` depends on `sirv`, and `tests/e2e/production.spec.ts` reads a `bin/security-headers.json` that is not committed. ADR-022 describes the intended state; see its Status.

---

## ADR-001: No backend — browser-only persistence and direct LLM fetch

**Date**: 2026-02-08 (initial commit `1e72af4` onward)
**Status**: Accepted

**Context**: The app needs to talk to local and remote LLM servers (OpenAI, LM Studio, GPT4ALL, Ollama, llama.cpp) without operating any server-side component of its own.

**Decision**: All state (config, chat history, system prompts) is persisted client-side in IndexedDB (`ai-chat-config`). All LLM calls go straight from the browser via `fetch()` to a user-supplied endpoint. There is no proxy or API layer in production.

**Consequences**: Zero backend to deploy or secure server-side, but CORS becomes the user's problem (see ADR-003 for the dev-only GPT4ALL proxy exception), and API keys live in the browser (IndexedDB), never sent anywhere but the configured endpoint.

**Update (2026-09-26, `91521d3`, `fa973ce`, `a0bdbd2`)**: Storage moved behind a shared IndexedDB layer in `src/lib/` (ADR-018). API keys are stored per provider and sent only to that provider's endpoint, with per-provider send and a global save switch (ADR-020). The "no backend" decision itself is unchanged.

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

**Update (2026-09-26, `c27294a`, `a0bdbd2`)**: `ChatAndSettings.tsx` was split into one file per component, and per-provider request building and response parsing moved to `src/lib/chatApi.ts` (ADR-021). The "no provider-abstraction interface" part still holds — providers remain branches, now in one pure, unit-tested module instead of a component. GPT4ALL is still reachable only through the Vite dev proxy; the production server and nginx image do not proxy it (documented in README/AGENTS.md by `27bd7dc`/`a8f5710`).

---

## ADR-004: Replace PWA with sirv-cli for npx/pnpm-dlx distribution

**Update (2026-08-14)**: The package manager itself moved from pnpm to bun — see ADR-012. The zero-install distribution model this ADR describes is unchanged; only the underlying tool invoked by `npx`/`bunx` differs.

**Date**: 2026-02-08 → 2026-02-09 (`7b6d374`, `0dfab71`, `43938c6`, `15a2d42`, `568713d`, `34d14e9`)
**Status**: Accepted

**Context**: The project originally shipped as a PWA (service worker + manifest). The goal shifted to distributing the app as a zero-install CLI tool runnable via `npx`/`pnpm dlx`.

**Decision**: `7b6d374` (:zap:) removed the PWA approach and introduced `sirv-cli` as the static file server, invoked through `bin/start.js`. Follow-up commits fixed the binary resolution (`43938c6` :bug:), added a `prepare` script to auto-build `dist/` on install-from-GitHub (`15a2d42` :wrench:), and added `--ignore-scripts` to the Dockerfile's `pnpm install` so `prepare` doesn't run before sources are copied (`568713d` :whale:). `0639b221` (:fire:) later cleaned up leftover service-worker references from Dockerfile/`.htaccess`.

**Consequences**: Simpler distribution model (one `pnpm dlx local-ai-chat-frontend` command) but no offline/installable-app capability. The package was also renamed `chat-fe` → `local-ai-chat-frontend` (`0dfab71` :package:, `11396258` :pencil2:) to match this distribution model.

**Update (2026-09-26, `c27294a`)**: `package.json` replaced the `sirv-cli` dependency with `sirv` (library), for a small Node HTTP server in `bin/start.js` that can add security headers (ADR-022). As of `a8f5710` the rewritten `bin/start.js` is not committed yet, so the committed script still invokes `sirv-cli` — see the working-tree note at the top.

---

## ADR-005: Biome as the sole linter/formatter, replacing ESLint/Prettier

**Date**: 2026-03-05 (`9246c78`, `7300ec7`, `5f936fa`)
**Status**: Accepted

**Context**: The project needed a lint/format toolchain alongside the new Playwright E2E setup (ADR-006).

**Decision**: `9246c78` (:wrench: "Add Biome and Playwright, update dockerignore and lockfile") introduced Biome. `7300ec7` (:art:) configured Biome v2 and reformatted all source files in one pass. `5f936fa` (:arrow_up:) upgraded Biome v1.9 → v2.4.5 shortly after.

**Consequences**: One tool covers both lint and format (`pnpm lint`, `pnpm format`), replacing the ESLint+Prettier combo. `biome.json` scopes to `src/` and `tests/`; `dist/` is excluded.

**Update (2026-07-20, `98198a2` "fix: update biome schema version and adjust linter rules")**: Bumped `$schema` from `2.4.5` → `2.5.4` and migrated the linter config key from the deprecated `"recommended": true` shorthand to `"preset": "recommended"`. Note that a separate ESLint flat config (`eslint.config.js`) still exists in the repo but remains unwired to any script or CI job — see [[known_bugs]] #10.

**Update (2026-09-26, `8ff975a`, `0bb4bcf`)**: `biome.json` replaced its own `indentStyle`/`indentWidth` with `useEditorconfig: true`, so `.editorconfig` (ADR-014) is the single source of indentation. The Lint workflow now pins Biome to the version in `bun.lock` (2.5.8) instead of `latest` (ADR-009 update).

---

## ADR-006: Playwright for E2E/screenshot testing

**Date**: 2026-03-05 (`e959d3a`)
**Status**: Accepted

**Context**: No automated UI testing existed before this point.

**Decision**: `e959d3a` (:white_check_mark: "Add Playwright E2E tests and migrate linter to Biome") added Playwright alongside the Biome migration, with a screenshot spec under `tests/e2e/`.

**Consequences**: `pnpm test:e2e`, `pnpm test:e2e:ui`, and `pnpm screenshot` became part of the standard command set. Coverage is screenshot/E2E only — no unit test framework has been introduced.

**Update (2026-09-26)**: Unit tests were introduced with Vitest (ADR-017), and Playwright grew from screenshots to GUI functional tests against a mocked LLM plus production-server checks (ADR-023). The screenshot spec still runs in the mobile/tablet/fhd projects.

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

**Update (2026-09-26, `a7ef4e3`)**: The pnpm-era `strict-peer-dependencies=false` line was removed from `.npmrc`.

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

**Update (2026-09-05, `f403644`)**: Dependabot was added for `github-actions`.

**Update (2026-09-26, `0bb4bcf`)**: Every Action is pinned to a commit SHA with a `# vX.Y.Z` comment (checkout v7.0.1, setup-takumi-guard-npm v1.2.0, setup-bun v2.2.0, setup-biome v2.7.1), Biome is pinned to 2.5.8, all workflows also run on `pull_request`, Dependabot also watches the `bun` ecosystem, and a fourth workflow `test.yml` runs `bunx tsc -b` and `bun run test:run` (installing with `--ignore-scripts` so `prepare` does not build first). Pinning trades automatic minor updates for reproducibility; Dependabot is what keeps the pins current.

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

**Date**: 2026-03-13, then 2026-06-13, then 2026-08-16 (`057f5ca`, `741e161`, `0e1b1b0`, `a52858b`, `251328e`, `b2b249a`, `0c58a5f`, `b7f42dc`, `a5a4b1b`, `a2d7640`, `7140fed`)
**Status**: Accepted (stabilized 2026-08-16 — see update below)

**Context**: `dist/` is Vite's build output. Whether to commit it is in tension with `bin/start.js`'s need to serve *something* for users who install via `pnpm dlx` from a git ref rather than a published npm tarball (where `prepare` runs `pnpm build` on install, per ADR-004).

**Decision history**:
1. `057f5ca` (2026-03-13) added `dist/` to `.gitignore` and removed tracked build artifacts — the "don't commit `dist/`" position, matching `docs/analyzed/overview.md`'s note "Build output (do not commit manually)".
2. `a52858b` (2026-06-13, 12:36) re-added `dist/index.html`, `dist/favicon.png`, and built JS/CSS assets directly to the repo, editing `.gitignore` to allow it.
3. `741e161` (2026-06-13, 12:41) followed up, further adjusting `.gitignore` to include `dist/` and adding a `prepare` script to `package.json`.
4. `0e1b1b0` (2026-06-13, 12:42) reversed course again, removing the favicon and `index.html` from `dist/`.
5. `251328e` (2026-06-13, 14:15) re-added the same `dist/` files a third time — `dist/index.html`, `dist/favicon.png`, and built assets were tracked in git as of that commit.
6. `aac5c0f` (2026-07-20) — labeled "Refactor code structure for improved readability and maintainability" but its actual diff only deletes `dist/assets/index-B4z3HPQR.css` and `dist/assets/index-BxL49gm8.js` (70 lines removed, no source files touched). **Mislabeled commit message** — the content is a partial reversal back toward "don't commit built assets," not a refactor. `dist/index.html` and `dist/favicon.png` were not touched by this commit, so `dist/` tracking is now in a mixed state (HTML/favicon tracked, JS/CSS assets not).

**Consequences**: This has oscillated across a full day and contradicts the "do not commit manually" guidance that was present in the now-migrated `docs/analyzed/overview.md` (see [[notes]] for the doc migration). Treat `dist/` tracking as unresolved — check `.gitignore` and `git ls-files dist/` directly before assuming either policy. Also note commit message accuracy has degraded here (`aac5c0f`'s message doesn't describe its actual change) — verify diffs directly rather than trusting subject lines for this file's history.

**Update (2026-08-16, `b2b249a` → `7140fed`)**: The oscillation continued for a second full day, this time also pulling `bin/start.js` into the same back-and-forth (it had been deleted entirely in an earlier, since-superseded cleanup — see ADR-015). `b2b249a` un-ignored and committed `dist/`; `0c58a5f` reverted that; `b7f42dc` partially un-committed `dist/index.html`/`favicon.png` without touching `.gitignore`; `a5a4b1b` re-created `bin/start.js`, re-committed `dist/`, and un-ignored both directories; `a2d7640` reverted `dist/` tracking again and re-ignored both. `7140fed` resolved the oscillation by splitting the two files' policies apart: `bin/start.js` is a small hand-written script, not a build artifact, so it stays tracked in git (`.gitignore`'s `bin/` entry was removed for good); `dist/` remains gitignored, and `bin/start.js` itself now builds it on demand if missing (see ADR-015).

**Consequences (final)**: `dist/` is *not* tracked in git — it is always gitignored and always built fresh, either by CI/local `bun run build` or by `bin/start.js`'s on-demand build path. `bin/start.js` *is* tracked, since it is source, not output. This distinction (source vs. generated artifact) is what the five-day oscillation across ADR-011 was ultimately missing — earlier attempts treated both files as one unit.

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

**Update (2026-08-16, `5f05ccc` "feat: add SKILL documentation for code analysis, landing page creation, and ADR updates")**: Claude Code's slash-command docs were migrated from flat files under `.claude/commands/*.md` to the `.claude/skills/<name>/SKILL.md` layout (each skill gets its own directory). `code-analyze.md` and `update-adr.md` moved as-is; `make-lp.md` and `make-social-preview.md` were merged/rewritten into `.claude/skills/make-lp/SKILL.md`. This is a mechanical reorganization to match Claude Code's skills convention, not a content change to `AGENTS.md` itself.

**Update (2026-08-16, `5d7b4ef`, `cc6f408`)**: `setup-act` and `make-social-preview` skills were added (the latter as its own skill again, separate from `make-lp`).

**Update (2026-09-26, `c5ddc65`, `f86e533`, `a8f5710`)**: The root `CLAUDE.md` (a one-line `@AGENTS.md` import) was deleted, leaving `AGENTS.md` as the only project instruction file. Skills now write their analysis output under `z-ai/` (git-ignored since `aec6190`): `code-analyze` → `z-ai/code/{CATEGORY}.md`, `update-adr` → `z-ai/code/ADR.md` (this file). `docs/ADR.md` is therefore no longer regenerated. `AGENTS.md` gained rules for English-only code comments, code-health checks (ADR-024), and the security practices of ADR-020/022.

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

**Update (2026-08-16, `dd4c5e8`, `a734a22`, `1058e49`, `3c28314`)**: The landing page switched its i18n to the `multilanguagejs` CDN build with five languages (en/ja/zh/es/ru), gained copy-to-clipboard buttons with SVG icons, and `docs/llms.txt` was added for LLM-assisted discovery. The `make-lp` skill was rewritten to describe this stack. The landing page's one-liner changed from `npx github:hidao80/local-ai-chat-frontend` to `npx local-ai-chat-frontend` (`9ca1e0f`, `83a1baa`) while `README.md` still shows the `github:` form (`681c35e`) — the two currently disagree, and whether the package is published to the npm registry is not recorded in the history (unverified).

---

## ADR-015: `bin/start.js` on-demand build, then abandon `bunx` for direct git-ref execution

**Date**: 2026-08-16 (`a5a4b1b`, `7140fed`, `a6c3a58`)
**Status**: Accepted

**Context**: `bin/start.js` (the `npx`/`bunx` entry point serving `dist/` via `sirv-cli`, see ADR-004) had been deleted in an earlier cleanup as "obsolete," leaving `npx`/`bunx github:hidao80/local-ai-chat-frontend` unable to start at all — there was no `dist/` and no server script. The goal was to make direct execution from a raw git ref work again without committing `dist/` (see ADR-011).

**Decision**: `a5a4b1b` re-created `bin/start.js` and added an on-demand build step: if `dist/index.html` is missing, it shell out to `npx vite build` before starting `sirv-cli`. `package.json` also gained a `trustedDependencies` entry (self-referencing the package name) to work around Bun's default lifecycle-script blocking, in case `prepare` was needed instead. In practice, testing against the real GitHub ref showed this doesn't work under `bunx`: `bunx` installs the package into an isolated temp `node_modules/<pkg>/` without pulling in `devDependencies` (`@tailwindcss/postcss`, `tailwindcss`, `typescript`, etc.), so the on-demand `vite build` fails on the PostCSS config requiring `@tailwindcss/postcss`, which isn't present. `npx` was tested against the same ref and works, because npm's dependency resolution for a git-ref install pulls in enough of the dependency tree for `vite build` to succeed. `7140fed` and `a6c3a58` then removed `bunx` from README.md, `docs/index.html`, and `bin/start.js`'s own printed usage tip, replacing it with `npx` and a note directing Bun users to `git clone && bun install && bun run build && bun start` instead.

**Consequences**: `npx https://github.com/hidao80/local-ai-chat-frontend` is the only supported one-liner for running the app directly from GitHub without cloning. `bunx` against the same ref is known to fail and is not advertised anywhere in user-facing docs. The `trustedDependencies` entry and the on-demand build path in `bin/start.js` remain in place (they don't hurt, and the on-demand build still helps `npx` users and local `bun start` after a `dist/` wipe), but they should not be read as having solved the `bunx` case — see [[known_bugs]] if `bunx` support is attempted again; the root cause (`devDependencies` not installed for a temp git-ref install) would need a different fix, e.g. publishing to the npm registry or shipping a pre-built tarball via GitHub Releases, both discussed and deferred.

**Update (2026-08-16, `8451021`, `7f725f5`)**: `package.json`'s `bin` briefly pointed at `./dist/start.js` and was reverted to `./bin/start.js` in the next commit; `files` became `["bin", "dist", "public"]` and the self-referencing `trustedDependencies` entry was removed.

**Update (2026-09-26, `a7ef4e3`)**: The package was versioned `1.0.0` with publish metadata (description, license, author, homepage, repository, bugs, keywords, `engines.node >= 18`).

---

## ADR-016: Deduplicate Tailwind Typography plugin registration

**Date**: 2026-08-16 (`94b3184`)
**Status**: Accepted

**Context**: Tailwind CSS v4 uses CSS-first configuration (`src/index.css`: `@import "tailwindcss";` plus `@plugin "@tailwindcss/typography";`), but `tailwind.config.js` had also been left importing and registering the same `@tailwindcss/typography` plugin via the legacy `plugins: [typography]` array — a leftover from the v3-style config that CSS-first `@plugin` was meant to replace.

**Decision**: `94b3184` removed the `import typography from '@tailwindcss/typography'` line and the `plugins: [typography]` array from `tailwind.config.js`, leaving `src/index.css`'s `@plugin` directive as the single registration point. `tailwind.config.js` is kept only for `content` globs and `theme.extend`.

**Consequences**: One source of truth for plugin registration, avoiding any risk of double-invocation. `tailwind.config.js` is still present (not fully removed) because it still supplies `content`/`theme` — this is expected under v4's config model, not a leftover.

---

## ADR-017: Vitest unit tests; non-UI logic lives in `src/lib/`

**Date**: 2026-09-26 (`a5a42c0`, `69f2038`, `1bf4aab`, `cd1fdb5`, `a0bdbd2`)
**Status**: Accepted (extends ADR-006)

**Context**: Only screenshot E2E tests existed (ADR-006), and every helper lived unexported inside the component file, so nothing could be tested in isolation.

**Decision**: Vitest was added with jsdom and `fake-indexeddb` (`a5a42c0`, config in `vite.config.ts` by `69f2038`; `coverage/` ignored by `cd1fdb5`). Non-UI logic moved to `src/lib/` with colocated `*.test.ts` (`1bf4aab`: `chatStorage`, `configStorage`, `markdown`, `model`), and `src/lib/` must not import from `src/components/` — `ApiConfig` moved to `src/lib/apiConfig.ts` for that reason (`91521d3`). CI runs `bunx tsc -b` and the unit tests (`test.yml`, ADR-009 update).

**Consequences**: Logic is testable without a browser; components keep only UI state. `tsc -b` (not `tsc --noEmit`) is the type-check command, because the root `tsconfig.json` only holds project references.

---

## ADR-018: Promise-based IndexedDB layer with user-facing error toasts

**Date**: 2026-09-26 (`91521d3`, `fa973ce`, `a0bdbd2`)
**Status**: Accepted

**Context**: Config and chat-history storage used callback-style IndexedDB code that swallowed errors, leaked connections on failure, and could leave a Promise pending on an aborted transaction.

**Decision**: A shared `src/lib/idb.ts` provides `openDatabase`, `ensureObjectStore` (idempotent upgrade), and `runInStore` (one request per transaction; rejects on open failure, synchronous throw, or abort; always closes the DB). `configStorage` and `chatStorage` are Promise-based on top of it. Failures map to an i18n hint by DOMException name (`storageError.ts`) and are shown as a `sonner` toast at the bottom right (`notifyStorageError.ts`); raw error messages are never shown. Saving a chat keeps its original `createdAt` by reading and writing in one transaction, and the history list is updated in place instead of reloading every session.

**Consequences**: Storage failures are visible and actionable (private browsing, quota, newer DB version, corruption). `sonner` became a runtime dependency; its injected `<style>` is why the CSP keeps `style-src 'unsafe-inline'` (ADR-022).

---

## ADR-019: Reasoning capability from LM Studio's native API

**Date**: 2026-09-26 (`fa973ce`, `a0bdbd2`)
**Status**: Accepted

**Context**: Reasoning support was guessed from model names only, so LM Studio models whose names did not match got no reasoning control, and on/off-only models could not be switched at all.

**Decision**: For LM Studio, `GET /api/v1/models` (`capabilities.reasoning.allowed_options`) classifies each model as `effort` (low/medium/high), `toggle` (off/on), `fixed` (always on) or none; other providers and older LM Studio fall back to the name heuristic. The 🧠 mark shows for every reasoning-capable model. Settings shows an effort selector or an on/off selector by type. On `/v1/chat/completions`, a toggle model is switched off with `reasoning_effort: "none"` and on with an effort value (`"on"` is rejected with HTTP 400) — behavior measured against a real LM Studio server.

**Consequences**: The detected support is stored in the config (`reasoningSupport`, `reasoningEnabled`) so the chat request matches what Settings showed. Turning thinking on makes it possible, not guaranteed; the model still decides.

---

## ADR-020: API keys per provider, with send/save switches

**Date**: 2026-09-26 (`91521d3`, `fa973ce`, `a0bdbd2`)
**Status**: Accepted

**Context**: A security audit found the model list was fetched on every keystroke of the endpoint field with the API key attached (a partially typed host could receive it), and one key was shared across providers, so switching provider sent it to the new provider's default endpoint. The key was also described as "securely" stored while being plain text in IndexedDB.

**Decision**: The endpoint is committed only on blur/Enter. Keys are stored per provider (`apiKeys`), the `Authorization` header is always built from `getAuthKey(config)` (the selected provider's key, or nothing), each provider has a send switch (`sendApiKey`), and a global `saveApiKeys: false` drops keys before they are written. Configs saved with the old single `apiKey` are migrated on load. The UI now says keys are stored unencrypted, and Settings warns when an `http:` endpoint is not loopback.

**Consequences**: Keys survive provider switches but never cross providers. Changing the endpoint within one provider keeps the key and sends it to the committed endpoint — an explicit user action, controllable with the send switch.

---

## ADR-021: One file per component; LLM I/O in `src/lib/chatApi.ts` with streaming

**Date**: 2026-09-26 (`c27294a`, `a0bdbd2`)
**Status**: Accepted (supersedes ADR-003's "all in `ChatAndSettings.tsx`")

**Context**: `ChatAndSettings.tsx` had grown past 1,200 lines. Replies were non-streaming, tokens/s used prompt-inclusive totals over the whole request time, and a reply that arrived after the user switched chats was appended to the chat now on screen.

**Decision**: The file was split into `Settings.tsx`, `Chat.tsx`, `ChatSidebar.tsx`, `ConfirmModal.tsx`, and `Minimap.tsx` (the old file was deleted by `c27294a`). `chatApi.ts` builds each provider's request and reads SSE (OpenAI-compatible, with `stream_options.include_usage`), NDJSON (Ollama), or plain JSON (GPT4ALL, or servers that ignore `stream`). tokens/s is completion tokens over generation time (Ollama's own `eval_duration` when present). A reply is bound to the session it was asked in and saved there even if the user switches away; Enter during IME composition does not send.

**Consequences**: Components hold UI state only; request/response code is covered by unit tests. Streaming re-renders Markdown for every message on each chunk — memoizing `renderMarkdown` is an open TODO.

---

## ADR-022: No outbound requests from rendered replies; security headers

**Date**: 2026-09-26 (`a0bdbd2`, `7516eb5`, `9e7d0b0`)
**Status**: Accepted — partially committed (see Consequences)

**Context**: The audit found that DOMPurify's defaults still let model output load external resources (images, `srcset`, CSS `url()` in `style`, media, SVG `image`/`feImage`, forms), which a prompt-injected reply could use to exfiltrate the conversation. No server sent CSP or anti-framing headers, and `sirv-cli` ran with `--cors --dev` in production.

**Decision**: `renderMarkdown` forbids those tags/attributes and turns every non-`data:image` `<img>` into a click-to-open link, done on an inert `DOMParser` document so nothing loads meanwhile (`a0bdbd2`). `index.html` adds a CSP meta (`img-src 'self' data:`, `media-src 'none'`, `object-src 'none'`, `form-action 'none'`, `base-uri 'self'`) (`7516eb5`). Response headers — CSP with `frame-ancestors 'none'` and `connect-src *` (users choose any LLM endpoint), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP — are defined once in `bin/security-headers.json` and mirrored in `nginx.conf` (`7516eb5`), which the Dockerfile now copies (`9e7d0b0`). `bin/start.js` serves them with `sirv` + Node `http`, drops `--cors`/`--dev`, validates `PORT`/`HOST`, and builds without a shell. HSTS is left to whatever terminates TLS.

**Consequences**: As of `a8f5710`, the nginx side and the rendering changes are committed, but `bin/security-headers.json` and the rewritten `bin/start.js` are not, so the committed `npx`/`bun start` path still runs `npx sirv-cli` without the headers (and without `sirv-cli` in `dependencies`). Committing those two files completes this ADR; `tests/e2e/production.spec.ts` checks the headers, SPA fallback, the app under the CSP, and that `nginx.conf` matches the JSON.

---

## ADR-023: Playwright functional tests against a mocked LLM

**Date**: 2026-09-26 (`f50e18b`, `e7644b1`)
**Status**: Accepted (extends ADR-006)

**Context**: E2E tests only took screenshots; nothing exercised the GUI's behavior, and no real LLM server can be assumed in tests.

**Decision**: Playwright gained a `functional` project (1280×800, `en-US`) whose specs drive the GUI while `page.route` fakes an LM Studio server at `http://localhost:1234` (`tests/e2e/support/app.ts`), including streamed SSE replies and held responses. A `production` project builds the app and serves it with `bin/start.js` on port 4174 (`e7644b1`). Specs cover reasoning controls, chat rendering and sanitization, API-key handling, storage-error toasts, streaming, session-bound replies, IME Enter, and production headers.

**Consequences**: Behavior is testable without an LLM server; `bun run test:gui` runs the functional project. The E2E suite is not run in CI yet.

---

## ADR-024: Code-health checks with knip and jscpd

**Date**: 2026-09-26 (`c27294a`, `a8f5710`)
**Status**: Accepted

**Context**: Unused dependencies (`bootstrap`, `@heroicons/react`) and dead exports had accumulated unnoticed, and there was no check for duplicated code.

**Decision**: `knip.json` and `.jscpd.json` were added, and the unused dependencies removed (`c27294a`). `AGENTS.md` requires running `bunx knip@6.38.0` and `bunx jscpd@5.3.2 src tests bin --reporters console` after refactors or dependency changes; both run through `bunx` with pinned versions rather than as dependencies. `knip.json` ignores only `docs/**` (the independent GitHub Pages site) and the `act` binary; jscpd uses `threshold: 0`, and its HTML report directory `report/` is git-ignored.

**Consequences**: A clean run reports nothing, so new dead code or duplication is visible immediately. Neither check runs in CI yet.

---

## Summary table

| ADR | Decision | Status |
|-----|----------|--------|
| 001 | No backend; IndexedDB + direct fetch | Accepted |
| 002 | Boolean nav, no router | Accepted |
| 003 | Direct per-provider fetch, no abstraction layer (moved to `chatApi.ts`, ADR-021) | Accepted |
| 004 | PWA → sirv-cli for npx/pnpm-dlx distribution (now `sirv` library, ADR-022) | Accepted |
| 005 | Biome replaces ESLint/Prettier | Accepted |
| 006 | Playwright for E2E/screenshots | Accepted |
| 007 | pnpm overrides for esbuild security patch | Superseded / volatile |
| 008 | `.npmrc` ignore-scripts + min release age | Accepted |
| 009 | Split CI into build/lint/audit workflows | Accepted |
| 010 | Docs moved to `.claude/` + `docs/analyzed/` | Superseded by 013 |
| 011 | `dist/` gitignored, built on demand; `bin/start.js` tracked | Accepted |
| 012 | Package manager: pnpm → bun | Accepted |
| 013 | Consolidate AI-agent docs into `AGENTS.md`; commands → skills | Accepted |
| 014 | Landing page hardening (OGP, DESIGN.md, editorconfig) | Accepted |
| 015 | `bin/start.js` on-demand build; `bunx` direct-run abandoned for `npx` | Accepted |
| 016 | Deduplicate Tailwind Typography plugin registration | Accepted |
| 017 | Vitest unit tests; non-UI logic in `src/lib/` | Accepted |
| 018 | Promise-based IndexedDB layer + error toasts | Accepted |
| 019 | Reasoning capability from LM Studio native API | Accepted |
| 020 | API keys per provider with send/save switches | Accepted |
| 021 | One file per component; `chatApi.ts` with streaming | Accepted |
| 022 | No outbound requests from replies; security headers | Accepted (partially committed) |
| 023 | Playwright functional tests against a mocked LLM | Accepted |
| 024 | Code-health checks with knip and jscpd | Accepted |

a8f57103e1e73d5369729a5d1be8103672d86194
