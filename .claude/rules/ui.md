---
paths:
  - "src/**/*.tsx"
  - "src/locales/**"
  - "src/i18n.ts"
  - "src/**/*.css"
---

# React / UI

- React: functional components only. Define prop types inline as object literals (not separate `interface Props`), matching existing components.
- All user-visible text goes through `useTranslation()` — add new keys to **both** `src/locales/en.json` and `src/locales/ja.json`. Call `t("key")` directly — do not add `|| "fallback"` literals.
- `App.tsx` is the sole router; the `showSettings` boolean is the only navigation mechanism — do not introduce a router library.
- Tailwind CSS 4, dark mode via `.dark` class on `<html>` (`dark:` variants, not media queries). `--nav-h` CSS custom property holds nav height for layout calculations.
