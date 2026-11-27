#!/usr/bin/env bash
# C# replacement for check.sh: finish the generated client (NuGet ids and metadata, the Crossly.Core reference,
# vendored extras; see codegen/integrations/extras/csharp/finish.mjs) and build it. For the seller client also
# build Crossly.AspNetCore, and examples/ once the client is generated from the current specs.
#
#   bash codegen/ci/check-csharp.sh <client-dir>        (from the repository root)
set -euo pipefail
dir="$1"
ci="$(cd "$(dirname "$0")" && pwd)"
extras="$ci/../integrations/extras/csharp"
node "$extras/finish.mjs" "$dir"
build() { dotnet build "$1" -c Release -nologo -v q -clp:ErrorsOnly; }
echo "::group::check csharp in $dir"
build "$(ls "$dir"/src/*/*.csproj | head -1)"
echo "::endgroup::"
if [ "$(basename "$dir")" = seller ]; then
  echo "::group::Crossly.AspNetCore"
  build "$extras/Crossly.AspNetCore/Crossly.AspNetCore.csproj"
  echo "::endgroup::"
  # The examples track the CURRENT spec: before this repository's first release, the committed client is older.
  if ls examples/*/*.csproj >/dev/null 2>&1; then
    if [ -n "${CROSSLY_SPEC_DIR:-}" ] || grep -q '"seller"' "$ci/../state.json"; then
      for p in examples/*/*.csproj; do
        echo "::group::example $p"
        build "$p"
        echo "::endgroup::"
      done
      echo "examples OK"
    else
      echo "examples skipped: the committed client predates this repository's first release"
    fi
  fi
fi
echo "csharp OK"
