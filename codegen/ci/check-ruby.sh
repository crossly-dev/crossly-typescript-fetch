#!/usr/bin/env bash
# Check one generated Ruby client, then exercise the hand-written layer against it.
#
#   bash codegen/ci/check-ruby.sh <client-dir>      (check.sh ruby <client-dir> hands over to this)
#
# Works on a scratch copy, so Gemfile.lock, .bundle/ and vendor/bundle never land in seller/ or buyer/ (the release
# commits those directories). Into that copy it vendors what assemble.mjs vendors (codegen/repo.json), so the
# extras are checked against THIS client even before a release has assembled them in.
#
#  1. what a consumer's first install does: bundle install (runtime deps), require the gem;
#  2. no generated constant shadows a hand-written one (Crossly::Client, CrosslyBuyer::Client);
#  3. codegen/integrations/extras/ruby/tests/smoke.rb: retries, Retry-After, idempotency keys, errors, pagination,
#     the Rack and Rails webhook middleware, with a stubbed transport.
set -euo pipefail
src="$(cd "$1" && pwd)"
api="$(basename "$src")"
here="$(cd "$(dirname "$0")" && pwd)"
codegen="$(dirname "$here")"
extras="$codegen/integrations/extras/ruby"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R "$src" "$work/client"
cd "$work/client"

echo "::group::vendor into a copy of $api"
node - "$codegen/repo.json" "$api" "$codegen/integrations" "$work/client" <<'JS'
const [repoJson, api, from, to] = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
for (const v of JSON.parse(fs.readFileSync(repoJson, 'utf8')).vendor ?? []) {
  if (!v.to.startsWith(`${api}/`)) continue;
  const dest = path.join(to, v.to.slice(api.length + 1));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(from, v.from), dest);
  console.log(`vendored ${v.from} -> ${v.to}`);
}
JS
echo "::endgroup::"

echo "::group::check ruby in $1"
bundle config set --local path vendor/bundle
# Runtime deps only: the template's dev group (rubocop -> jaro_winkler) has a C extension that no longer builds on
# gcc 15, and a consumer never installs it.
bundle config set --local without 'development test'
bundle install --quiet
gem=$(ls *.gemspec | head -1 | sed 's/\.gemspec$//')
bundle exec ruby -Ilib -e "require '$gem'; puts 'required ok'"
for f in lib/"$gem"/client.rb; do
  if [ -e "$f" ] && ! grep -q 'CrosslyKit::Client' "$f"; then
    echo "::error::$f is generated and would collide with the hand-written $gem client" >&2
    exit 1
  fi
done
if find lib/"$gem"/models -name 'client.rb' | grep -q .; then
  echo "::error::a generated model is named Client; rename the hand-written facade or the schema" >&2
  exit 1
fi
echo "::endgroup::"

if [ -f "$extras/tests/smoke.rb" ] && [ -f lib/crossly_kit.rb ]; then
  echo "::group::ruby extras against $api"
  for f in lib/crossly_kit.rb lib/"$gem"/client.rb lib/crossly_webhooks.rb; do ruby -wc "$f" >/dev/null; done
  bundle exec ruby -Ilib "$extras/tests/smoke.rb" "$api"
  echo "::endgroup::"
fi
echo "ruby OK"
