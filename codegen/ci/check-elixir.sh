#!/usr/bin/env bash
# Compile one generated Elixir client, then exercise the hand-written layer against it.
#
#   bash codegen/ci/check-elixir.sh <client-dir>      (check.sh elixir <client-dir> hands over to this)
#
# Works on a scratch copy, so deps/, _build/ and mix.lock never land in seller/ or buyer/ (the release commits
# those directories).
#
#  1. what a consumer's first build does: mix deps.get, mix compile;
#  2. into the copy, the files assemble.mjs vendors into the seller package (codegen/repo.json: the verifier,
#     Crossly, Crossly.Adapter, Crossly.WebhookPlug), plus plug, which every Phoenix app has (1.14.x: the newest
#     that builds on the Elixir 1.14 checked here); the buyer copy gets them too, test-only, to prove
#     Crossly.client/2 drives the buyer modules. Compiled with no warning in those files, then
#     codegen/integrations/extras/elixir/tests/smoke.exs runs against a fake adapter.
set -euo pipefail
src="$(cd "$1" && pwd)"
api="$(basename "$src")"
here="$(cd "$(dirname "$0")" && pwd)"
codegen="$(dirname "$here")"
extras="$codegen/integrations/extras/elixir"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R "$src" "$work/client"
cd "$work/client"
# the release build applies the same fix in place before packaging (no Model.AnyType is ever generated)
node "$extras/patch_generated.mjs" lib

echo "::group::check elixir in $1"
mix local.hex --force >/dev/null
mix local.rebar --force >/dev/null
mix deps.get
mix compile
echo "::endgroup::"

if [ -f "$extras/tests/smoke.exs" ]; then
  echo "::group::elixir extras against $api"
  node - "$codegen/repo.json" "$codegen/integrations" "$work/client/lib" <<'JS'
const [repoJson, from, lib] = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
for (const v of JSON.parse(fs.readFileSync(repoJson, 'utf8')).vendor ?? []) {
  const dest = path.join(lib, path.basename(v.to));
  fs.copyFileSync(path.join(from, v.from), dest);
  console.log(`vendored ${v.from} -> lib/${path.basename(v.to)}`);
}
JS
  sed -i 's/{:tesla, /{:plug, "~> 1.14.2"},\n      {:tesla, /' mix.exs
  # as the release build declares it for the seller package (the verifier calls :crypto)
  sed -i 's/extra_applications: \[:logger\]/extra_applications: [:logger, :crypto]/' mix.exs
  mix deps.get
  mix compile 2>&1 | tee "$work/compile.log"
  mine='lib/(crossly|crossly_adapter|crossly_webhook_plug|crossly_webhooks)\.ex'
  if grep -A3 -E '^\s*warning' "$work/compile.log" | grep -E "$mine" ; then
    echo "::error::the hand-written Elixir files compile with warnings (above)" >&2
    exit 1
  fi
  mix run "$extras/tests/smoke.exs" "$api"
  echo "::endgroup::"
fi
echo "elixir OK"
