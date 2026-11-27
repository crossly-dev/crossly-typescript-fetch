#!/usr/bin/env bash
# typescript-fetch's replacement for check.sh:   bash codegen/ci/check-typescript-fetch.sh <seller|buyer>
#
# Finishes the generated client (npm metadata, the vendored modules exported: see
# codegen/integrations/extras/typescript-fetch/finish.mjs), compiles it with tsc into dist/ exactly as
# `npm pack` will, runs the hand-written layer's smoke tests against that build, and (seller) type-checks the
# Hono middleware against the real Hono types.
set -euo pipefail
dir="$1"
ci="$(cd "$(dirname "$0")" && pwd)"
extras="$ci/../integrations/extras/typescript-fetch"

echo "::group::finish typescript-fetch $dir"
node "$extras/finish.mjs" "$dir"
echo "::endgroup::"

cd "$dir"
echo "::group::compile $dir"
npm install --no-audit --no-fund --ignore-scripts --no-package-lock
npx tsc -p .
echo "::endgroup::"

echo "::group::smoke-test the hand-written layer in $dir"
node "$extras/smoke.mjs" .
echo "::endgroup::"

if [ "$(basename "$PWD")" = seller ]; then
  echo "::group::type-check honoWebhook and examples/ against hono"
  rm -rf zz_hono_check && cp -r "$extras/hono-check" zz_hono_check
  # The repo-root examples/ compile against this client too (@crossly/fetch mapped to ./src).
  if [ -d "$ci/../../examples" ]; then mkdir -p zz_hono_check/examples && cp "$ci"/../../examples/*.ts zz_hono_check/examples/; fi
  trap 'rm -rf zz_hono_check' EXIT
  npm install --no-audit --no-fund --ignore-scripts --no-package-lock --no-save hono@4.10.8
  npx tsc -p zz_hono_check
  echo "::endgroup::"
fi
echo "typescript-fetch $dir OK"
