# Toolchain

- This project uses **bun** as its package manager (`packageManager` field in `package.json`, `bun.lock`). Do not introduce npm/yarn/pnpm commands or lockfiles.
- Keep the `bun` version in `mise.toml` in sync with `packageManager` in `package.json`.
- After any code change, confirm `bun run build` exits 0.
