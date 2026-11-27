#!/usr/bin/env bash
# Java replacement for check.sh: finish the generated client (coordinates, Central metadata, vendored extras; see
# codegen/integrations/extras/java/finish.mjs), compile it, and for the seller client also compile examples/
# against it once the client is generated from the current specs.
#
#   bash codegen/ci/check-java.sh <client-dir>        (from the repository root)
set -euo pipefail
dir="$1"
ci="$(cd "$(dirname "$0")" && pwd)"
node "$ci/../integrations/extras/java/finish.mjs" "$dir"
# An 11 MB spec is ~4,000 classes: Maven itself stays small, javac is forked with its own heap (finish.mjs).
export MAVEN_OPTS="${MAVEN_OPTS:--Xmx3g -XX:+UseParallelGC}"
echo "::group::check java in $dir"
(cd "$dir" && mvn -B -q -DskipTests -Dmaven.javadoc.skip=true compile)
echo "::endgroup::"

# The examples track the CURRENT spec: before this repository's first release, the committed client is older.
fresh() { [ -n "${CROSSLY_SPEC_DIR:-}" ] || grep -q '"seller"' "$ci/../state.json"; }
if [ "$(basename "$dir")" = seller ] && [ -d examples ] && ls examples/*.java >/dev/null 2>&1; then
  if fresh; then
    echo "::group::compile examples"
    (cd "$dir" && mvn -B -q dependency:build-classpath -Dmdep.outputFile=target/classpath.txt)
    rm -rf "$dir/target/examples"
    javac -nowarn -d "$dir/target/examples" -cp "$dir/target/classes:$(cat "$dir/target/classpath.txt")" examples/*.java
    echo "::endgroup::"
    echo "examples OK"
  else
    echo "examples skipped: the committed client predates this repository's first release"
  fi
fi
echo "java OK"
