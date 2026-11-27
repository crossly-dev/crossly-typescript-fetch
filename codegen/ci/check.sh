#!/usr/bin/env bash
# Compile-check one generated client with its own language toolchain.
#
#   bash ci/check.sh <lang> <client-dir>
#
# "Builds" means what a consumer's first build would do: resolve dependencies
# and compile (or, for interpreted languages, load every module). Warnings are
# not failures; the 5.4.0 templates emit plenty of them.
set -euo pipefail
lang="$1"
dir="$2"
# A language may replace this whole check with its own script (tools/sdk-repo/files/codegen/ci/check-<lang>.sh).
own="$(dirname "$0")/check-$lang.sh"
if [ -f "$own" ]; then exec bash "$own" "$dir"; fi
cd "$dir"
echo "::group::check $lang in $dir"
case "$lang" in
  python)
    python -m pip install -q -r requirements.txt
    pkg=$(sed -n 's/^NAME = "\(.*\)"/\1/p' setup.py | tr - _)
    python -m compileall -q "$pkg" >/dev/null
    # Import every module: catches a bad cross-folder import the sharding wrote.
    python - "$pkg" <<'PY'
import importlib, pkgutil, sys
pkg = importlib.import_module(sys.argv[1])
n = 0
for m in pkgutil.walk_packages(pkg.__path__, pkg.__name__ + '.'):
    importlib.import_module(m.name)
    n += 1
print(f'imported {n} modules')
PY
    ;;
  php)
    composer validate --no-check-publish --no-check-lock -q || true
    # Syntax-check every file, in parallel.
    find lib -name '*.php' -print0 | xargs -0 -n 1 -P 8 php -l >/dev/null
    composer install -q --no-interaction --no-progress
    php -r 'require "vendor/autoload.php"; echo "autoload ok\n";'
    ;;
  go)
    go build ./...
    go vet ./... >/dev/null 2>&1 || echo "(go vet reported issues; not a build failure)"
    ;;
  ruby)
    bundle config set --local path vendor/bundle
    # Runtime deps only: the template's dev group (rubocop → jaro_winkler) has a C
    # extension that no longer builds on gcc 15, and a consumer never installs it.
    bundle config set --local without 'development test'
    bundle install --quiet
    gem=$(ls *.gemspec | head -1 | sed 's/\.gemspec$//')
    bundle exec ruby -Ilib -e "require '$gem'; puts 'required ok'"
    ;;
  java)
    export MAVEN_OPTS="-Xmx4g"
    mvn -B -q -DskipTests -Dmaven.javadoc.skip=true compile
    ;;
  kotlin)
    chmod +x gradlew
    ./gradlew --no-daemon -q compileKotlin \
      -Dorg.gradle.jvmargs=-Xmx4g -Pkotlin.compiler.execution.strategy=in-process
    ;;
  csharp)
    dotnet build -c Release -nologo -v q "$(ls *.sln | head -1)"
    ;;
  rust)
    cargo check -q
    ;;
  swift)
    swift build
    ;;
  dart)
    dart pub get
    dart analyze --no-fatal-warnings
    ;;
  typescript-fetch)
    npm install --no-audit --no-fund --ignore-scripts
    npx tsc -p . --noEmit
    ;;
  elixir)
    mix local.hex --force >/dev/null
    mix local.rebar --force >/dev/null
    mix deps.get
    mix compile
    ;;
  *)
    echo "unknown language: $lang" >&2
    exit 2
    ;;
esac
echo "::endgroup::"
echo "$lang OK"
