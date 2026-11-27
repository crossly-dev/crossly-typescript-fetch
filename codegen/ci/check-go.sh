#!/usr/bin/env bash
# Go's replacement for check.sh:   bash codegen/ci/check-go.sh <seller|buyer>
#
# Finishes the generated client (module path, vendored ergonomics and webhook middleware: see
# codegen/integrations/extras/go/finish.mjs), then builds it, runs the hand-written layer's tests (copied in for
# the run, never shipped) and builds the Gin/Echo adapter modules.
set -euo pipefail
dir="$1"
ci="$(cd "$(dirname "$0")" && pwd)"
extras="$ci/../integrations/extras/go"

echo "::group::finish go $dir"
node "$extras/finish.mjs" "$dir"
echo "::endgroup::"

cd "$dir"
echo "::group::build go $dir"
go build ./...
go vet ./webhooks/
echo "::endgroup::"

echo "::group::test the hand-written layer in $dir"
pkg=$(sed -n 's/^package \([a-z_]*\)$/\1/p' client.go | head -1)
sed "s/^package crossly$/package $pkg/" "$extras/client/crossly_extras_test.go" > zz_crossly_extras_test.go
cp "$extras/webhooks/middleware_test.go" webhooks/zz_middleware_test.go
trap 'rm -f zz_crossly_extras_test.go webhooks/zz_middleware_test.go' EXIT
go test -count=1 -run 'TestCrossly|TestMiddleware' . ./webhooks/
echo "::endgroup::"

for m in webhooks/ginx webhooks/echox; do
  [ -d "$m" ] || continue
  echo "::group::build $dir/$m"
  (cd "$m" && go build ./... && go vet ./...)
  echo "::endgroup::"
done

# The repo-root examples/ (net/http only) must compile against this client: each is built as a package inside the
# seller module, then removed.
examples="$ci/../../examples"
if [ "$(basename "$PWD")" = seller ] && [ -d "$examples" ]; then
  echo "::group::build examples against $dir"
  for ex in "$examples"/*/; do
    [ -f "$ex/main.go" ] || continue
    name="zz_example_$(basename "$ex")"
    mkdir -p "$name" && cp "$ex"/*.go "$name"/
    if ! go build -o /dev/null "./$name"; then rm -rf "$name"; exit 1; fi
    rm -rf "$name"
  done
  echo "::endgroup::"
fi
echo "go $dir OK"
