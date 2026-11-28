# Code style

- **Write every code comment in English** — source, tests, JSDoc, and comments in config files (`vite.config.ts`, `playwright.config.ts`, `docker/nginx.conf`, `docker/Dockerfile`, workflows, `index.html`, `bin/`). This applies to new and edited comments alike. User-visible text is not a comment: it goes through i18n (see `ui.md`).
- Formatter/linter: **Biome** (`biome.json`), not ESLint/Prettier. 2-space indent, double quotes, imports auto-organized — don't hand-reorder them.
- TypeScript strict mode is on (`tsconfig.app.json`): `noUnusedLocals`, `noUnusedParameters`, etc. Eliminate unused code rather than prefixing with `_`.
- `src/lib/` holds non-UI helpers and must not import from `src/components/`.
- Keep request building and response parsing in `src/lib/chatApi.ts`, not in components.
- `index.html` has OGP/Twitter Card/JSON-LD — keep them in sync with `package.json`/README when the project name or description changes.
- `docs/` is the GitHub Pages site, independent from the Vite app — edit it directly (no build step).
