---
paths:
  - "bin/**"
  - "docker/**"
  - "compose*.yml"
  - "docker-compose*.yml"
  - ".github/**"
  - "tests/e2e/production.spec.ts"
---

# Security: server, headers, CI

- `bin/start.js` validates `PORT`/`HOST` before use and never spawns through a shell (it runs the `vite` package's bin with `process.execPath`).
- Security headers (CSP incl. `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP) are defined once in `bin/security-headers.json` and mirrored in `docker/nginx.conf`; `tests/e2e/production.spec.ts` checks both match and that the built app works under the CSP. Change them together and keep the values identical. HSTS belongs to whatever terminates TLS.
- GitHub Actions are pinned to commit SHAs (`# vX.Y.Z` comment) and Biome to the version in `bun.lock`; bump both deliberately.
