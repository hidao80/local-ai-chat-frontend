# Code health checks

Run **knip** (unused code and dependencies) and **jscpd** (duplicated code) after refactoring, adding or removing dependencies, or finishing a feature, and before reporting the work as done.

- `bunx knip@6.38.0` reports unused files, exports, types and dependencies, plus binaries used but not listed in `package.json`.
  - Remove what your change made unused (imports, exports, files, dependencies). Before deleting anything knip reports, confirm with a search that it is really unused.
  - `knip.json` excludes `docs/**` (the GitHub Pages site is independent of the Vite app) and the `act` binary (a separately installed tool used by the `act*` scripts), so a clean run reports nothing and exits 0. Extend those ignores only for code that is used outside knip's view, never to hide real dead code.
  - For pre-existing findings outside your change, report them instead of deleting them.
- `bunx jscpd@5.3.2 src tests bin --reporters console` finds duplicated code with the settings in `.jscpd.json` (`threshold: 0`, so any clone makes it exit 1). Without `--reporters console` it also writes an HTML report to `report/` (git-ignored).
  - Do not add new duplication: extract shared logic into `src/lib/` (app code) or `tests/e2e/support/` (E2E helpers) instead of copying it.
  - Pre-existing clones are not a reason to refactor unrelated code; mention them.
- Both tools run through `bunx` with pinned versions (no `package.json` entry); bump the versions deliberately, as with GitHub Actions.
