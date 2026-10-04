#!/usr/bin/env bash
# Decide which test jobs a change needs and write the result to $GITHUB_OUTPUT.
# Usage: BASE_SHA=<commit to diff against> .github/scripts/detect-changes.sh
# Without a usable BASE_SHA (first push, force push, local run) everything is selected.
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
base="${BASE_SHA:-}"

all=false
files=""
if [ -z "$base" ] || [[ "$base" =~ ^0+$ ]] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  all=true
else
  files="$(git diff --name-only "$base" HEAD)"
fi

# $1 = file list, $2 = extended regex
matches() { grep -Eq "$2" <<<"$1"; }

# Dependency, tooling and CI changes can affect every job
if matches "$files" '^(package\.json|bun\.lock|\.npmrc|bunfig\.toml|\.github/(workflows/test\.yml|actions/|scripts/))'; then
  all=true
fi

# Config files shared by the app build, type-check and Vitest
config='tsconfig[^/]*\.json$|vite\.config\.ts$|tailwind\.config\.js$|postcss\.config\.js$'

typecheck=false
if [ "$all" = true ] || matches "$files" "^(src/|$config)"; then
  typecheck=true
fi

# none: skip, related: only tests that import a changed file (vitest --changed), all: full run
unit=none
if [ "$all" = true ] || matches "$files" "^(src/test/|$config)"; then
  unit=all
elif matches "$files" '^src/'; then
  unit=related
fi

# E2E projects. screenshot.spec.ts is a documentation tool, so CI never runs it.
app="src/|index\.html$|public/|playwright\.config\.ts$|$config|tests/e2e/support/"
functional_files="$(grep -vE '^tests/e2e/(production|screenshot)\.spec\.ts$' <<<"$files" || true)"
projects=()
if [ "$all" = true ] || matches "$functional_files" "^($app|tests/e2e/)"; then
  projects+=('"functional"')
fi
if [ "$all" = true ] || matches "$files" "^($app|bin/|nginx\.conf$|tests/e2e/production\.spec\.ts$)"; then
  projects+=('"production"')
fi
e2e="[$(IFS=,; echo "${projects[*]:-}")]"

{
  echo "base=$base"
  echo "typecheck=$typecheck"
  echo "unit=$unit"
  echo "e2e=$e2e"
} >>"$out"
