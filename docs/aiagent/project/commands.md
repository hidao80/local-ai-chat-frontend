---
name: project-commands
description: Common development and maintenance commands for this repository
type: reference
---

## Commands

- `pnpm install`: Install dependencies
- `pnpm dev`: Start dev server (Vite, http://localhost:5173)
- `pnpm build`: Type-check + build to dist/
- `pnpm lint`: Biome lint
- `pnpm format`: Biome format
- `pnpm exec tsc --noEmit`: Type-check only
- `pnpm preview`: Serve built dist/
- `pnpm start`: Serve dist/ via sirv-cli (production mode)

# E2E tests (Playwright)
- `pnpm test:e2e`: Run all E2E tests headless
- `pnpm test:e2e:ui`: Playwright UI mode
- `pnpm test:e2e:headed`: Run headed
- `pnpm screenshot`: Run screenshot spec only

# Docker
- `docker compose up`: Dev
- `docker build -t local-ai-chat-frontend .`: Production image
- `docker run -p 80:80`: local-ai-chat-frontend

# Podman
- `podman compose up`: Dev
- `podman build -t local-ai-chat-frontend .`: Production image
- `podman run -p 80:80`: local-ai-chat-frontend

After any code change, confirm `pnpm build` exits 0.
