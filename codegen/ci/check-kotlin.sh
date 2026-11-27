#!/usr/bin/env bash
# Kotlin replacement for check.sh: finish the generated client (Gradle 8 + Kotlin 2 build, coordinates, Central
# metadata, vendored extras; see codegen/integrations/extras/kotlin/finish.mjs), compile it, and for the seller
# client also compile examples/ against it once the client is generated from the current specs.
#
#   bash codegen/ci/check-kotlin.sh <client-dir>        (from the repository root)
set -euo pipefail
dir="$1"
ci="$(cd "$(dirname "$0")" && pwd)"
node "$ci/../integrations/extras/kotlin/finish.mjs" "$dir"
chmod +x "$dir/gradlew"
echo "::group::check kotlin in $dir"
(cd "$dir" && ./gradlew --no-daemon -q compileKotlin)
echo "::endgroup::"

# The examples track the CURRENT spec: before this repository's first release, the committed client is older.
fresh() { [ -n "${CROSSLY_SPEC_DIR:-}" ] || grep -q '"seller"' "$ci/../state.json"; }
if [ "$(basename "$dir")" = seller ] && ls examples/*.kt >/dev/null 2>&1; then
  if fresh; then
    echo "::group::compile examples"
    # A composite build: examples-check depends on net.crossly:crossly-kotlin, which Gradle takes from seller/.
    (cd "$dir" && ./gradlew --no-daemon -q -p "$ci/../integrations/extras/kotlin/examples-check" compileKotlin)
    echo "::endgroup::"
    echo "examples OK"
  else
    echo "examples skipped: the committed client predates this repository's first release"
  fi
fi
echo "kotlin OK"
