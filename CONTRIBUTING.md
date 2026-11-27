# Contributing to crossly-typescript-fetch

Thanks for helping. Most of this repository is generated, which decides where a fix goes.

| path | what | where a fix goes |
|---|---|---|
| `seller/`, `buyer/` | clients generated from https://crossly.net/openapi/{seller,buyer}.json | an issue here: the API spec or the generator gets fixed |
| `webhooks/` | the hand-written webhook verifier + test vectors | an issue or a PR against `codegen/integrations/webhooks/typescript-fetch/` |
| `codegen/` | the pinned generator and this repo's release tooling | an issue: it is synced from the Crossly monorepo |
| `examples/` | runnable examples | pull requests welcome |

## Regenerate locally

Needs Node 20 and Java 8 or newer (on Java 11+ the newer generator line is picked; CI pins 5.4.0).

```sh
node codegen/ci/fetch-specs.mjs
CROSSLY_SPEC_DIR=codegen/specs node codegen/scripts/generate-sdks.mjs --lang typescript-fetch
node codegen/ci/assemble.mjs
bash codegen/ci/check.sh typescript-fetch seller
```

## How releases happen

[release.yml](.github/workflows/release.yml) runs daily. When the specs changed, it regenerates, builds, runs the
webhook vectors, writes the CHANGELOG entry and the next version, commits and tags, then publishes with signed
build provenance. Nobody releases by hand.
