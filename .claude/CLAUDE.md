# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

When starting any task, read the files below that are relevant to the task:

- Modifying UI components or screens → read `.claude/analyzed/components.md`, `.claude/analyzed/screens.md`
- Modifying data persistence → read `.claude/analyzed/databases.md`
- Modifying utilities or helper functions → read `.claude/analyzed/utilities.md`
- Adding new features → read `.claude/analyzed/todo.md`, `.claude/analyzed/known_bugs.md`, `.claude/analyzed/notes.md`
- Checking build or dev commands → read `docs/aiagent/project/commands.md`, `.claude/analyzed/development-workflow.md`
- Reviewing configuration (Vite, TypeScript, Tailwind, i18n) → read `.claude/analyzed/configurations.md`
- Reviewing dependencies or licenses → read `.claude/analyzed/dependencies.md`
- Reviewing CI/CD, Docker, or deployment → read `.claude/analyzed/infrastructure.md`
- Investigating performance issues → read `.claude/analyzed/performance.md`
- Security review or audit → read `.claude/analyzed/security.md`
- Writing or reviewing tests → read `.claude/analyzed/test.md`
- Naming new variables/functions/stores → read `.claude/analyzed/naming_convention.md`
- Understanding user flows → read `.claude/analyzed/use_cases.md`

## Analysis Index (`.claude/analyzed/`)

| File | Contents |
|---|---|
| `dependencies.md` | Libraries, versions, licenses, vulnerabilities |
| `infrastructure.md` | CI/CD, Docker, Apache/.htaccess |
| `databases.md` | IndexedDB schemas & access patterns |
| `screens.md` | Screens, routing, view conventions |
| `configurations.md` | Build/lint/runtime config |
| `components.md` | React component responsibilities |
| `utilities.md` | Helper functions & IndexedDB wrappers |
| `performance.md` | Bottleneck candidates (static analysis) |
| `known_bugs.md` | Known bugs & inconsistencies |
| `security.md` | OWASP-aligned audit |
| `test.md` | E2E test coverage |
| `development-workflow.md` | Dev/build/release process |
| `notes.md` | Misc implementation notes |
| `todo.md` | Prioritized follow-ups |
| `naming_convention.md` | Naming conventions |
| `use_cases.md` | Use case diagram |
| `ADR.md` | Architecture decision records |

## Always-loaded Documents

- @.claude/rules/code-style.md
- @.claude/rules/security.md
- @docs/aiagent/project/architecture.md

## Subagents

Use the following sub-agents in parallel, if available.

- **Code Review:** `code-reviewer`
- **Test:** `code-tester`

### Key files

- `src/App.tsx`: Root component. Manages global state (config, dark mode, i18n, system prompts). Persists everything to IndexedDB.
- `src/components/ChatAndSettings.tsx`: All UI logic — - `Settings` and `Chat` components. LLM API calls, chat history, minimap, streaming responses, per-model system prompts.
- `src/i18n.ts`: i18next initialization. Loads `locales/en.json` and `locales/ja.json`. Auto-detects browser language.
- `src/utils/maked.js`: Legacy markdown helper (unused — `ChatAndSettings.tsx` imports `marked` directly).
- `bin/start.js`: Entry point for `npx`/`pnpm dlx` usage. Starts sirv-cli to serve `dist/`.
- `vite.config.ts`: Vite config. Dev proxy: `/api/gpt4all` → `http://localhost:4891`.

