#!/usr/bin/env bash
# Rust's replacement for check.sh:   bash codegen/ci/check-rust.sh <seller|buyer>
#
# Finishes the generated crate (crates.io metadata, the vendored client/webhook modules wired in: see
# codegen/integrations/extras/rust/finish.mjs), then checks it with every feature on (axum and actix-web
# extractors included). The hand-written layer's unit tests run on the buyer crate: the code is identical in both,
# and the buyer crate is a fifth the size, so its test build is the cheap one.
set -euo pipefail
dir="$1"
ci="$(cd "$(dirname "$0")" && pwd)"

echo "::group::finish rust $dir"
node "$ci/../integrations/extras/rust/finish.mjs" "$dir"
echo "::endgroup::"

cd "$dir"
if [ "$(basename "$PWD")" = buyer ]; then
  echo "::group::test the hand-written layer in $dir (all features)"
  cargo test -q --lib --all-features -- client:: webhooks_http::
  echo "::endgroup::"
else
  echo "::group::check $dir (all features)"
  cargo check -q --all-features
  echo "::endgroup::"
  # The repo-root examples/ (a crate depending on ../seller) must compile against this client. Its own
  # target dir, outside the seller crate, so `cargo package` never sees it; removed afterwards.
  if [ -f "$ci/../../examples/Cargo.toml" ]; then
    echo "::group::check examples against $dir"
    # The examples follow the CURRENT specs. A committed tree generated before this release tooling (crate version
    # behind codegen/state.json) may predate them, so there a mismatch is a warning; everywhere else it fails.
    crate_v=$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)
    state_v=$(node -p "require('$ci/../state.json').version")
    if CARGO_TARGET_DIR="${RUNNER_TEMP:-/tmp}/crossly-examples-target" cargo check -q --manifest-path "$ci/../../examples/Cargo.toml"; then
      :
    elif [ "$crate_v" != "$state_v" ]; then
      echo "::warning::examples/ do not compile against this pre-release tree ($crate_v; specs are at $state_v)"
    else
      exit 1
    fi
    rm -f "$ci/../../examples/Cargo.lock"
    echo "::endgroup::"
  fi
fi
echo "rust $dir OK"
