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

- Strict mode is on across all three tsconfig files (`tsconfig.app.json`, `tsconfig.node.json`).
- Eliminate unused variables and parameters — the compiler will reject them.
- Use `PascalCase` for types/interfaces, `camelCase` for variables/functions.
- Use relative imports from `src/`. No barrel re-exports unless already present.
- After any edit run `bunx tsc --noEmit` and then `bun run build` to confirm zero errors.

## React

- Functional components only. No class components.
- Define prop types inline as object type literals (not separate `interface Props`), consistent with existing components.
- Use `useTranslation()` for all user-visible strings. Never hardcode UI text — add keys to **both** `src/locales/en.json` and `src/locales/ja.json`.
- The `||` fallback pattern (`t("key") || "日本語"`) exists in legacy code; prefer proper i18n keys for new strings.

## Component structure

- `ChatAndSettings.tsx` exports `Settings` and `Chat` as named exports. Keep them in one file — do not split unless the file exceeds maintainability limits.
- `App.tsx` is the sole router; the `showSettings` boolean is the only navigation mechanism. Do not introduce a router library.
- Sub-components (`Minimap`, `ChatSidebar`, `ConfirmModal`) live in the same file as their consumers unless reused elsewhere.

## Styling

- Tailwind CSS 4. Dark mode is toggled via `.dark` class on `<html>` — use `dark:` variants, not media queries.
- Nav height is available as `--nav-h` CSS custom property for layout calculations.
- Do not mix Bootstrap utility classes with Tailwind for the same element (Bootstrap is a dependency but Tailwind is the primary styling system).
