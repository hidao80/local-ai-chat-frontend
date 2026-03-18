# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

When starting any task, read the files below that are relevant to the task:

- Modifying UI components or screens → read `docs/analyzed/components.md`, `docs/analyzed/screens.md`
- Modifying data persistence → read `docs/analyzed/databases.md`
- Modifying utilities or helper functions → read `docs/analyzed/utilities.md`
- Adding new features → read `docs/analyzed/todo.md`, `docs/analyzed/known_bugs.md`, `docs/analyzed/notes.md`
- Checking build or dev commands → read `docs/aiagent/project/commands.md`
- Reviewing configuration (Vite, TypeScript, Tailwind, i18n) → read `docs/analyzed/configuration.md`

## Always-loaded Documents

- @.claude/rules/code-style.md
- @.claude/rules/security.md
- @docs/aiagent/project/architecture.md
- @docs/analyzed/overview.md

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

