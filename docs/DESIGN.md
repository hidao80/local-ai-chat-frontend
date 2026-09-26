# Code Style Rules

## Formatter / Linter

- Tool: **Biome** (`biome.json`) — not ESLint/Prettier.
- `bun run lint` runs `biome lint`; `bun run format` runs `biome format`.
- Biome scope: `src/` and `tests/`. `dist/` is excluded.

## Formatting conventions (from `biome.json`)

- Indent: **2 spaces** (no tabs).
- Quotes: **double quotes** in JS/TS.
- Imports: Biome auto-organizes imports (`organizeImports: on`). Do not manually reorder.

## TypeScript

- Strict mode is on in `tsconfig.app.json` and `tsconfig.node.json`. `tsconfig.json` only holds project references and sets no strictness options itself.
- Eliminate unused variables and parameters — the compiler will reject them.
- Use `PascalCase` for types/interfaces, `camelCase` for variables/functions.
- Use relative imports from `src/`. No barrel re-exports unless already present.
- After any edit run `bunx tsc -b` and then `bun run build` to confirm zero errors.

## React

- Functional components only. No class components.
- Define prop types inline as object type literals (not separate `interface Props`), consistent with existing components.
- Use `useTranslation()` for all user-visible strings. Never hardcode UI text — add keys to **both** `src/locales/en.json` and `src/locales/ja.json`.
- Call `t("key")` directly; do not add `|| "fallback"` literals.

## Component structure

- One component per file in `src/components/` (`Settings.tsx`, `Chat.tsx`, `ChatSidebar.tsx`, `ConfirmModal.tsx`, `Minimap.tsx`), each a named export.
- `App.tsx` is the sole router; the `showSettings` boolean is the only navigation mechanism. Do not introduce a router library.
- LLM request building and response parsing live in `src/lib/chatApi.ts`, not in components.

## Styling

- Tailwind CSS 4. Dark mode is toggled via `.dark` class on `<html>` — use `dark:` variants, not media queries.
- Nav height is available as `--nav-h` CSS custom property for layout calculations.
