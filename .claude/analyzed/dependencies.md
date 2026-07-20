---
name: analyzed-dependencies
description: Direct dependencies, versions, licenses, and vulnerability/update status.
type: analysis
commit-hash: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34
---

# Dependencies

## Table of Contents

- [Runtime Dependencies](#runtime-dependencies)
- [Dev Dependencies](#dev-dependencies)
- [Vulnerability Status](#vulnerability-status)
- [Update Status](#update-status)
- [Unused Dependencies](#unused-dependencies)

---

## Runtime Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `react` | 19.2.7 | MIT | UI framework |
| `react-dom` | 19.2.7 | MIT | DOM renderer |
| `@vitejs/plugin-react` | 5.2.0 | MIT | Vite React fast-refresh plugin |
| `vite` | 7.3.5 | MIT | Build tool / dev server |
| `i18next` | 25.10.10 | MIT | i18n core |
| `react-i18next` | 16.6.6 | MIT | React bindings for i18next |
| `marked` | 16.4.2 | MIT | Markdown → HTML parser (used with `dangerouslySetInnerHTML`, see [[security]]) |
| `sirv-cli` | 3.0.1 | MIT | Static file server used by `bin/start.js` |
| `@heroicons/react` | 2.2.0 | MIT | **Unused** (Factual — no import found in `src/`) |
| `bootstrap` | 5.3.8 | MIT | **Unused** (Factual — Tailwind is the sole styling system per [[code-style]]) |

## Dev Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `typescript` | 5.8.3 | Apache-2.0 | Type checking (strict mode) |
| `@types/react` | 19.2.17 | MIT | React type defs |
| `@types/react-dom` | 19.2.3 | MIT | ReactDOM type defs |
| `@biomejs/biome` | 2.4.16 | MIT OR Apache-2.0 | Lint/format (see [[configurations]]) |
| `eslint` | 9.39.4 | MIT | Secondary linter (flat config) |
| `@eslint/js` | 9.39.4 | MIT | ESLint recommended rules |
| `typescript-eslint` | 8.61.0 | MIT | TS rules for ESLint |
| `eslint-plugin-react-hooks` | 5.2.0 | MIT | Hooks lint rules |
| `eslint-plugin-react-refresh` | 0.4.26 | MIT | Fast-refresh lint rule |
| `globals` | 14.0.0 (declared `^16.5.0`) | MIT | Global identifier defs for ESLint |
| `tailwindcss` | 4.3.0 | MIT | CSS framework |
| `@tailwindcss/postcss` | 4.3.0 | MIT | PostCSS plugin for Tailwind v4 |
| `@tailwindcss/typography` | 0.5.20 | MIT | `prose` typography plugin |
| `postcss` | 8.5.15 | MIT | CSS transform pipeline |
| `autoprefixer` | 10.5.0 | MIT | Vendor prefixing |
| `@playwright/test` | 1.60.0 | Apache-2.0 | E2E test runner |

**Speculative** (installed version vs. semver range mismatch, unconfirmed cause): `globals` resolves to `14.0.0` while `package.json` declares `^16.5.0`. Likely a stale lockfile entry or peer resolution quirk. Recommend: ★3 — run `pnpm update globals` and re-verify `pnpm-lock.yaml`.

## Vulnerability Status

**Factual** — `pnpm audit --json` (run at commit `1e98095`):

```json
{
  "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0 },
  "totalDependencies": 306
}
```

No known advisories across 306 resolved packages (90 prod, 147 dev, 90 optional). CI enforces this via `.github/workflows/audit.yml` → `pnpm audit --audit-level=high` (see [[infrastructure]]).

Supply-chain scanning: `flatt-security/setup-takumi-guard-npm` runs in `lint.yml` and `audit.yml` (malware/typosquat detection), per `README.md` Contributing section.

## Update Status

- All direct dependencies are on their latest or near-latest majors as of analysis date (React 19, Vite 7, Tailwind 4, TypeScript 5.8).
- `.npmrc` sets `min-release-age=7` — pnpm will not install a package version published less than 7 days ago (supply-chain safety net against fresh malicious publishes).
- `.npmrc` sets `ignore-scripts=true` — install-time scripts are disabled globally; `pnpm-workspace.yaml` explicitly allows `esbuild`'s build script (`allowBuilds: { esbuild: true }`).

## Unused Dependencies

**Factual** (no matching import found via source grep):

| Package | Evidence |
|---|---|
| `@heroicons/react` | No `from "@heroicons/react"` in `src/` |
| `bootstrap` | No `bootstrap` import/CSS link; Tailwind is the styling system (see [[code-style]]) |

Recommendation: ★4 — remove both from `package.json` unless planned for near-term use. See [[todo]].

<!-- commit: 1e98095b63fc3c649e8e1d7f4cd9e3fe5b911b34 -->
