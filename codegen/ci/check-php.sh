#!/usr/bin/env bash
# Compile-check one generated PHP client, then exercise the hand-written layer against it.
#
#   bash codegen/ci/check-php.sh <client-dir>      (check.sh php <client-dir> hands over to this)
#
# Works on a scratch copy, so composer's vendor/ and composer.lock never land in seller/ or buyer/ (the release
# commits those directories).
#
#  1. what a consumer's first install does: every file lints, composer installs, the autoloader loads;
#  2. the extras (Crossly facade, retries, errors, pagination, webhook middleware) run against THIS client with a
#     mocked transport: tests/smoke.php in codegen/integrations/extras/php. When the extras are already vendored
#     into lib/ (after assemble.mjs) that copy is the one loaded.
set -euo pipefail
src="$(cd "$1" && pwd)"
api="$(basename "$src")"
here="$(cd "$(dirname "$0")" && pwd)"
codegen="$(dirname "$here")"
extras="$codegen/integrations/extras/php"
hooks="$codegen/integrations/webhooks/php"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R "$src" "$work/client"

echo "::group::check php in $1"
cd "$work/client"
composer validate --no-check-publish --no-check-lock -q || true
find lib -name '*.php' -print0 | xargs -0 -n 1 -P 8 php -l >/dev/null
composer install -q --no-interaction --no-progress
php -r 'require "vendor/autoload.php"; echo "autoload ok\n";'
echo "::endgroup::"

if [ -d "$extras" ]; then
  echo "::group::php extras against $api"
  find "$extras" "$hooks" -name '*.php' -print0 | xargs -0 -n 1 php -l >/dev/null
  mkdir -p "$work/smoke"
  if [ "$api" = buyer ]; then
    psr4="\"Crossly\\\\Buyer\\\\\": \"$work/client/lib/\", \"Crossly\\\\\": [\"$extras/\", \"$hooks/\"]"
  else
    psr4="\"Crossly\\\\\": [\"$work/client/lib/\", \"$extras/\", \"$hooks/\"]"
  fi
  cat > "$work/smoke/composer.json" <<JSON
{
  "require": {
    "php": ">=7.4",
    "guzzlehttp/guzzle": "^7.3",
    "guzzlehttp/psr7": "^2.0",
    "psr/http-server-middleware": "^1.0"
  },
  "autoload": { "psr-4": { $psr4 } }
}
JSON
  (cd "$work/smoke" && composer install -q --no-interaction --no-progress)
  php "$extras/tests/smoke.php" "$api" "$work/smoke/vendor/autoload.php"
  echo "::endgroup::"
fi
echo "php OK"
