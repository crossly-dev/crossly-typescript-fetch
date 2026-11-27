#!/usr/bin/env node
/**
 * Generate the Crossly SDKs for every target language, from the OpenAPI specs.
 *
 *   node scripts/generate-sdks.mjs                 everything
 *   node scripts/generate-sdks.mjs --lang python   one language
 *   node scripts/generate-sdks.mjs --api buyer     one API
 *   node scripts/generate-sdks.mjs --list          what would be built
 *
 * ── TWO APIS × N LANGUAGES ───────────────────────────────────────────
 * Crossly is two APIs with two principals — a seller PAT does not
 * authenticate the buyer surface and vice versa — so each language gets two
 * packages, exactly as TypeScript does (@crossly/sdk and @crossly/buyer-sdk).
 * One merged client per language would have half its methods 401 for whatever
 * credential the caller holds, and no amount of documentation fixes that.
 *
 * ── WHERE THIS RUNS ──────────────────────────────────────────────────
 * On GitHub Actions in the public crossly-dev/crossly-sdk-gen repo
 * (tools/sdk-gen/ here is that repo's skeleton; tools/ci/publish-sdk-specs.mjs
 * copies this script, its two helpers, the webhook verifiers and the emitted
 * specs there). Layout differences are handled by CROSSLY_SPEC_DIR (default
 * packages/api/openapi) and by accepting either `<api>.openapi.json` or
 * `<api>.json` as the spec file name.
 *
 * ── WHY THE GENERATOR IS PINNED TO 5.4.0 ─────────────────────────────
 * The workflow runs it on Java 8. Generator 6.x and 7.x are compiled for Java
 * 11+ and die with UnsupportedClassVersionError before reading the spec. 5.4.0
 * is the last line that runs on 8, and it only speaks OpenAPI 3.0 — which is
 * why emit-openapi.ts emits 3.0.3 rather than 3.1. Every compile check so far
 * was made against 5.4.0 output; OPENAPI_GENERATOR_VERSION overrides the pick.
 *
 * Raise both together when the toolchain moves: the pin here and the `openapi`
 * version in emit-openapi.ts are one decision, not two.
 *
 * ── GENERATED CODE IS NOT EDITED ─────────────────────────────────────
 * Everything under sdks/ is output. Fixing a generated client by hand means
 * the fix disappears on the next run and nobody knows why. If output is wrong,
 * the spec is wrong — change the route's schema, re-emit, regenerate.
 * The few scripted post-steps below (model folders, go mod tidy, one dart
 * cast) run on every generation, so they are part of the output, not edits.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LAYOUT, sdkPackageName, tidyGeneratedDocs, whereThingsAre } from './sdk-layout.mjs';
import { modelAreas, shardModels } from './sdk-shard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = process.env.CROSSLY_SPEC_DIR
  ? resolve(process.env.CROSSLY_SPEC_DIR)
  : join(ROOT, 'packages', 'api', 'openapi');
const OUT_ROOT = join(ROOT, 'sdks');

/**
 * The generator JAR is invoked DIRECTLY, not through
 * @openapitools/openapi-generator-cli.
 *
 * The npm wrapper resolves its JAR version from an `openapitools.json` found
 * relative to cwd — and that resolution behaves differently depending on the
 * shell. Run from bash it honoured the pin; run through `execSync` (which uses
 * cmd.exe on Windows) it silently fell back to the latest 7.x JAR, which needs
 * Java 11 and died with UnsupportedClassVersionError. Same command, same cwd,
 * different answer. A build step that depends on which shell invoked it is not
 * a build step.
 *
 * `java -jar` has no such ambiguity: the version is the file path.
 */
const JAR_DIR = join(ROOT, '.tools');

/**
 * Generator 6+ requires Java 11. 5.4.0 is the last line that runs on Java 8,
 * and it only speaks OpenAPI 3.0 — which is why emit-openapi.ts emits 3.0.3.
 * Picked from the runtime rather than pinned, so a machine with a modern JDK
 * gets the better generator without editing this file.
 */
function pickGeneratorVersion() {
  let raw = '';
  try {
    raw = execSync('java -version 2>&1', { encoding: 'utf8' });
  } catch {
    console.error('No `java` on PATH. OpenAPI Generator is a Java program — install a JDK (11+ preferred).');
    process.exit(1);
  }
  // "1.8.0_503" → 8;  "17.0.9" → 17
  const m = raw.match(/version "(\d+)(?:\.(\d+))?/);
  const major = m ? (m[1] === '1' ? Number(m[2]) : Number(m[1])) : 8;
  if (process.env.OPENAPI_GENERATOR_VERSION) return { version: process.env.OPENAPI_GENERATOR_VERSION, java: major };
  return major >= 11
    ? { version: '7.25.0', java: major }
    : { version: '5.4.0', java: major };
}

const MAVEN = (v) =>
  `https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${v}/openapi-generator-cli-${v}.jar`;

/**
 * The two APIs. `id` prefixes the package name; `spec` is the emitted file.
 */
const specFile = (id) => [`${id}.openapi.json`, `${id}.json`].find((f) => existsSync(join(SPEC_DIR, f))) ?? `${id}.json`;
const APIS = [
  { id: 'seller', spec: specFile('seller'), blurb: "a seller's store — listings, crossposting, orders" },
  { id: 'buyer', spec: specFile('buyer'), blurb: "a shopper's own cart, orders, wishlists and offers" },
];

/**
 * Target languages.
 *
 * Ordered by who actually integrates with a reselling API. PHP ranks higher
 * than it usually would because the WooCommerce/WordPress seller base is
 * large, and Java/C# lower because enterprise integrators tend to arrive last.
 */
const LANGUAGES = [
  { id: 'python', generator: 'python', pkgOpt: 'packageName' },
  { id: 'php', generator: 'php', pkgOpt: 'invokerPackage' },
  { id: 'go', generator: 'go', pkgOpt: 'packageName' },
  { id: 'ruby', generator: 'ruby', pkgOpt: 'gemName' },
  { id: 'java', generator: 'java', pkgOpt: 'invokerPackage' },
  { id: 'csharp', generator: 'csharp-netcore', pkgOpt: 'packageName' },
  { id: 'rust', generator: 'rust', pkgOpt: 'packageName' },

  // ── Mobile and JVM-adjacent ────────────────────────────────────────
  // Kotlin and Swift are here because a reselling app is a phone app more
  // often than it is a server, and a seller building one should not have to
  // hand-roll an HTTP layer.
  { id: 'kotlin', generator: 'kotlin', pkgOpt: 'packageName' },
  { id: 'swift', generator: 'swift5', pkgOpt: 'projectName' },
  { id: 'dart', generator: 'dart', pkgOpt: 'pubName' },

  // ── Runtimes the hand-written TS SDK does not serve ────────────────
  // @crossly/sdk targets Node and browsers. `typescript-fetch` has no Node
  // dependency at all, which is what Cloudflare Workers, Deno and Bun need —
  // and those are where an awful lot of small integrations actually run.
  { id: 'typescript-fetch', generator: 'typescript-fetch', pkgOpt: 'npmName' },

  // ── Server languages with real ecommerce presence ──────────────────
  { id: 'elixir', generator: 'elixir', pkgOpt: 'packageName' },
];

const argv = process.argv.slice(2);
const only = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
};
const onlyLang = only('--lang');
const onlyApi = only('--api');
const LIST = argv.includes('--list');

const langs = onlyLang ? LANGUAGES.filter((l) => l.id === onlyLang) : LANGUAGES;
const apis = onlyApi ? APIS.filter((a) => a.id === onlyApi) : APIS;

if (!langs.length) {
  console.error(`unknown language: ${onlyLang}. Known: ${LANGUAGES.map((l) => l.id).join(', ')}`);
  process.exit(2);
}

/**
 * Package-path options beyond the package name, per language.
 *
 * Java's generator defaults its packages to `org.openapitools.client.api` /
 * `.model` whatever `invokerPackage` says, so every published class sat under
 * `org/openapitools/client/` — another project's namespace. Setting them puts
 * the code under `net/crossly/{api,model}` (buyer: `net/crossly/buyer/…`).
 * This CHANGES Java import paths; there has been no Maven release yet, which
 * is the cheapest time to do it. Every other language already nests its
 * models and APIs under the package name (Go cannot — see sdk-layout.mjs).
 */
function packageOptions(lang, api) {
  if (lang.id === 'java') {
    const pkg = packageName(lang, api);
    return [`apiPackage=${pkg}.api`, `modelPackage=${pkg}.model`];
  }
  // Without it the runtime types `fetch` as `GlobalFetch`, a lib type
  // TypeScript removed in 3.6 — the client did not compile on any current tsc.
  if (lang.id === 'typescript-fetch') return ['typescriptThreePlus=true'];
  // camelCase enum entries named `value` / `name` clash with the enum class's
  // own `value` property and `name` — Kotlin refused a dozen spatial and vault
  // enums whose wire values are literally "value" and "name".
  if (lang.id === 'kotlin') return ['enumPropertyNaming=UPPERCASE'];
  // Go writes enum constants unprefixed by default, so two enums that both
  // hold `date` declared `DATE` twice in one package.
  if (lang.id === 'go') return ['enumClassPrefix=true'];
  return [];
}

/**
 * What the generator writes besides the client itself.
 *
 * Off: a test stub per model and per API (`modelTests`, `apiTests`) — ~2,700
 * files per client asserting nothing, each a placeholder that instantiates
 * the model and stops — and a doc page per model (`modelDocs`), another
 * ~2,700 that restate the model's fields. Together they were two thirds of
 * every client and pushed `docs/` and `test/` past the 1,000 entries GitHub
 * will list. The API doc pages stay: one per API group, a usage example per
 * method, which is the documentation people actually read. `tidyGeneratedDocs`
 * fixes the links that pointed at the dropped pages.
 *
 * `--global-property` is the 5.x spelling (formerly `-D` system properties);
 * 7.x accepts the same.
 */
const GLOBAL_PROPERTIES = 'apiTests=false,modelTests=false,modelDocs=false';

/**
 * The 5.4.0 go template writes a go.sum that is missing entries for its own
 * go.mod (golang.org/x/oauth2), so `go build` in the published repo stops at
 * "missing go.sum entry" before compiling a line. `go mod tidy` writes the real
 * one. Without a Go toolchain the client is still written, with a warning —
 * the regen workflow installs Go for exactly this.
 */
function tidyGoModule(dir) {
  try {
    execSync('go mod tidy', { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (err) {
    console.log(`\n  ! go mod tidy failed in ${dir} (${String(err.message).split('\n')[0]}) — go.sum is the template's, incomplete`);
  }
}

/**
 * The 5.4.0 dart template deserialises a list of free-form values — a field
 * typed `List<Map<String, Object>>` or `List<Object>` — with
 * `Map.listFromJson(…)` / `Object.listFromJson(…)`, which do not exist, so the
 * client did not analyse. No spec shape avoids it (an array of maps, of `{}`,
 * of `additionalProperties: true` all come out the same), and loosening the
 * spec would cost every other language its types. So the one call is
 * rewritten to the cast the template uses for a list of strings. Scoped to
 * that exact call on a declared list field; anything else is left alone.
 */
function castDartFreeFormLists(dir) {
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.dart') ? [join(d, e.name)] : [],
    );
  let changed = 0;
  for (const file of walk(join(dir, 'lib', 'model'))) {
    const text = readFileSync(file, 'utf8');
    if (!/\b(Map|Object)\.listFromJson\(/.test(text)) continue;
    const declared = new Map([...text.matchAll(/^\s+List<(.+)> (\w+);$/gm)].map((m) => [m[2], m[1]]));
    const next = text.replace(
      /\b(\w+): (?:Map|Object)\.listFromJson\(json\[r'([^']+)'\]\)/g,
      (whole, field, key) => {
        const element = declared.get(field);
        if (!element) return whole;
        changed += 1;
        return `${field}: json[r'${key}'] is List ? (json[r'${key}'] as List).cast<${element}>() : const []`;
      },
    );
    if (next !== text) writeFileSync(file, next);
  }
  return changed;
}

/**
 * The 5.4.0 typescript-fetch generator names an operation's parameter
 * interface `<OpId>Request`. When a model already has that name (the request
 * body of `updateSourceSyncLocation` is `UpdateSourceSyncLocationRequest`) it
 * renames the interface — and the inline enums of that operation's
 * parameters — to `<OpId>Operation…`, but the interface's field still names
 * the enum by the OLD name, so `tsc` stops at "Cannot find name
 * 'UpdateSourceSyncLocationPlatformEnum'". Only an operation with both the
 * collision and an inline enum parameter hits it. The renamed enum is given
 * back the name every reference uses; anything else is left alone.
 */
function fixTsCollidedParamEnums(dir) {
  const apis = join(dir, 'src', 'apis');
  if (!existsSync(apis)) return 0;
  let changed = 0;
  for (const name of readdirSync(apis).filter((f) => f.endsWith('.ts'))) {
    const file = join(apis, name);
    const before = readFileSync(file, 'utf8');
    let text = before;
    const defined = new Set([...text.matchAll(/^export enum (\w+)/gm)].map((m) => m[1]));
    const used = new Set([...text.matchAll(/:\s*(\w+Enum)\b/g)].map((m) => m[1]));
    for (const def of defined) {
      const m = def.match(/^(\w+)Operation(\w+Enum)$/);
      const want = m && `${m[1]}${m[2]}`;
      if (!want || defined.has(want) || !used.has(want)) continue;
      text = text.replace(new RegExp(`\\b${def}\\b`, 'g'), want);
      changed += 1;
    }
    if (text !== before) writeFileSync(file, text);
  }
  return changed;
}

/**
 * The release version written into every package manifest. Each SDK repo's release workflow sets
 * CROSSLY_SDK_VERSION (from its codegen/VERSION, bumped by the spec diff); a local run stays 0.1.0.
 * The generators disagree on the option's name (python/go/rust/csharp/elixir `packageVersion`, java/kotlin/php
 * `artifactVersion`, ruby `gemVersion`, swift `podVersion`, dart `pubVersion`, typescript `npmVersion`), and
 * each ignores the names it does not know, so all of them are passed.
 */
const SDK_VERSION = process.env.CROSSLY_SDK_VERSION || '0.1.0';
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(SDK_VERSION)) {
  console.error(`CROSSLY_SDK_VERSION must be semver, got ${SDK_VERSION}`);
  process.exit(2);
}
function versionOptions(v) {
  return ['packageVersion', 'artifactVersion', 'gemVersion', 'podVersion', 'pubVersion', 'npmVersion'].map(
    (k) => `${k}=${v}`,
  );
}

/** `crossly` / `crossly_buyer` — see `sdkPackageName` in sdk-layout.mjs. */
const packageName = (lang, api) => sdkPackageName(lang.id, api.id);

/**
 * `--webhooks-only` refreshes just the hand-written verifiers.
 *
 * Regenerating 24 clients takes ten minutes of JVM startup to deliver a file
 * copy. The verifier changes far more often than the spec does, and a ten
 * minute wait to fix a typo in it is how a step stops being run.
 */
const WEBHOOKS_ONLY = argv.includes('--webhooks-only');

const jobs = WEBHOOKS_ONLY ? [] : [];
if (!WEBHOOKS_ONLY) for (const api of apis) for (const lang of langs) jobs.push({ api, lang });

if (LIST) {
  console.log('');
  for (const { api, lang } of jobs) {
    console.log(`  sdks/${lang.id}/${api.id}   ${lang.generator}  ${packageName(lang, api)}`);
  }
  console.log(`\n  ${jobs.length} package(s)\n`);
  process.exit(0);
}

for (const spec of WEBHOOKS_ONLY ? [] : apis) {
  if (!existsSync(join(SPEC_DIR, spec.spec))) {
    console.error(
      `Missing ${spec.spec}. Run \`pnpm --filter @crosslister/api openapi\` first — the\n` +
        'specs are generated from the route tree, not hand-written.',
    );
    process.exit(1);
  }
}

mkdirSync(OUT_ROOT, { recursive: true });
mkdirSync(JAR_DIR, { recursive: true });

const { version: GEN_VERSION, java: JAVA_MAJOR } = pickGeneratorVersion();
const JAR = join(JAR_DIR, `openapi-generator-cli-${GEN_VERSION}.jar`);

if (!WEBHOOKS_ONLY && !existsSync(JAR)) {
  // The npx wrapper caches the same JARs, but under a hashed path that changes
  // with the cache. Fetching to a known location makes the toolchain a file we
  // control rather than something we hope is still there.
  console.log(`  fetching openapi-generator ${GEN_VERSION} (Java ${JAVA_MAJOR} detected)…`);
  const res = await fetch(MAVEN(GEN_VERSION));
  if (!res.ok) {
    console.error(`  could not download the generator: HTTP ${res.status} from Maven Central`);
    process.exit(1);
  }
  writeFileSync(JAR, Buffer.from(await res.arrayBuffer()));
}

console.log(`  generator ${GEN_VERSION} on Java ${JAVA_MAJOR}\n`);

const results = [];
const areaMaps = new Map();
const areasFor = (api) => {
  if (!areaMaps.has(api.id)) areaMaps.set(api.id, modelAreas(join(SPEC_DIR, api.spec)));
  return areaMaps.get(api.id);
};

for (const { api, lang } of jobs) {
  const out = join(OUT_ROOT, lang.id, api.id);
  const label = `${lang.id}/${api.id}`;
  process.stdout.write(`  ${label.padEnd(20)} `);

  // Wiped rather than merged: a stale file from a route that no longer exists
  // is a method that 404s, and the generator will not remove it for us.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const props = [
    `${lang.pkgOpt}=${packageName(lang, api)}`,
    ...versionOptions(SDK_VERSION),
    ...packageOptions(lang, api),
  ].join(',');

  // execSync with a quoted string, NOT execFileSync(..., {shell:true}).
  // On Windows the latter re-joins the argv array through cmd.exe and mangles
  // it — every one of the 14 jobs failed that way while the identical command
  // typed by hand succeeded, which is a miserable thing to debug.
  const cmd = [
    `java -jar "${JAR}"`,
    'generate',
    `-i "${join(SPEC_DIR, api.spec)}"`,
    `-g ${lang.generator}`,
    `-o "${out}"`,
    '--skip-validate-spec',
    `--global-property ${GLOBAL_PROPERTIES}`,
    `--additional-properties "${props}"`,
  ].join(' ');

  try {
    // The version is the JAR path above; every path in `cmd` is absolute.
    execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // The generator logs one INFO line per file it writes. At ~1,650
      // component schemas that is ~2.4 MB for one python client — past
      // execSync's 1 MB default, which kills the JVM mid-write with ENOBUFS
      // and reports every job FAILED with no Java error to show, while the
      // identical command typed by hand exits 0.
      maxBuffer: 256 * 1024 * 1024,
    });
    // Models into product-area folders before the README is written — see sdk-shard.mjs.
    shardModels(lang.id, out, areasFor(api));
    if (lang.id === 'go') tidyGoModule(out);
    if (lang.id === 'dart') castDartFreeFormLists(out);
    if (lang.id === 'typescript-fetch') fixTsCollidedParamEnums(out);
    const reduced = tidyGeneratedDocs(out, whereThingsAre(lang.id, api.id, packageName(lang, api)));
    results.push({ label, ok: true });
    console.log(`ok${reduced ? `  (${reduced} links to dropped model pages reduced to text)` : ''}`);
  } catch (err) {
    // Java's real complaint is in the middle of the output, not at the end —
    // the tail is always a Node stack from the CLI wrapper, which says nothing.
    const all = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
    const real =
      all.match(/Exception in thread[^\n]*/)?.[0] ??
      all.match(/^\s*(Error|Caused by)[^\n]*/m)?.[0] ??
      String(err.message).split('\n')[0];
    results.push({ label, ok: false, msg: real.trim().slice(0, 170) });
    console.log('FAILED');
  }
}

/**
 * Copy the hand-written webhook verifier into each language's output.
 *
 * ── WHY IT IS COPIED AND NOT GENERATED ───────────────────────────────
 * Webhook verification is not in the OpenAPI spec and cannot be — it is a
 * signing scheme, not an endpoint — so the generator has no way to produce it.
 * Without this every generated client can CALL the API and cannot verify a
 * single thing the API sends back, which is the half that has security
 * consequences.
 *
 * ── WHY IT LANDS IN sdks/<lang>/webhooks/ ────────────────────────────
 * Because `sdks/<lang>/seller` and `sdks/<lang>/buyer` are wiped on every run.
 * A hand-written file inside either would vanish on the next regeneration and
 * nobody would know why. `webhooks/` is a sibling the wipe never touches, and
 * it is one copy rather than two because verification is the same regardless
 * of which API sent the event.
 *
 * Source of truth is integrations/webhooks/<lang>/. Edit there.
 */
function copyWebhookPort(langId) {
  const from = join(ROOT, 'integrations', 'webhooks', langId);
  if (!existsSync(from)) return false;

  const to = join(OUT_ROOT, langId, 'webhooks');
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });

  for (const entry of readdirSync(from, { withFileTypes: true })) {
    // Conformance runners and build output are development artefacts of THIS
    // repo, not something a consumer of the SDK needs.
    // Dev artefacts of THIS repo, not something an SDK consumer needs: the
    // conformance runners, build output, and lockfiles for a crate they will
    // vendor rather than build here.
    if (entry.name.startsWith('_')) continue;
    if (['target', 'checkvectors', 'tests', 'Cargo.lock', '__pycache__'].includes(entry.name)) continue;
    if (/^(check_vectors|CheckVectors|check-vectors)/.test(entry.name)) continue;
    cpSync(join(from, entry.name), join(to, entry.name), { recursive: true });
  }

  // The vectors ship too: somebody forking a port should be able to prove it
  // still agrees without reverse-engineering what "correct" means.
  cpSync(
    join(ROOT, 'integrations', 'webhooks', 'test-vectors.tsv'),
    join(to, 'test-vectors.tsv'),
  );
  return true;
}

let withWebhooks = 0;
for (const lang of langs) {
  if (copyWebhookPort(lang.id)) withWebhooks += 1;
}
console.log(`\n  webhook verifier copied into ${withWebhooks}/${langs.length} language(s)`);

const failed = results.filter((r) => !r.ok);

console.log('');
console.log(`  ${results.length - failed.length}/${results.length} generated`);
if (failed.length) {
  console.log('');
  for (const f of failed) console.log(`  ! ${f.label}: ${f.msg}`);
  console.log('');
}

// A generated-code README, so nobody edits the output by hand.
writeFileSync(
  join(OUT_ROOT, 'README.md'),
  [
    '# Generated SDKs',
    '',
    '**Everything in this directory is generated. Do not edit it by hand** — a manual',
    'fix disappears on the next run and nobody will know why.',
    '',
    'If a client is wrong, the SPEC is wrong. Fix the route schema, re-emit, regenerate:',
    '',
    '```bash',
    'pnpm --filter @crosslister/api openapi   # derive + emit (the CI generate lane does this for you)',
    'pnpm sdk:publish-specs                   # Actions in crossly-dev/crossly-sdk-gen regenerates all 24',
    '```',
    '',
    'The published clients are the `crossly-dev/crossly-<language>` mirrors, written only by',
    'that workflow. A copy here is a snapshot (`node scripts/generate-sdks.mjs` still works',
    'locally with Java 8+, but nothing requires it).',
    '',
    '## Two APIs, two packages per language',
    '',
    'Crossly is two APIs with two principals. A seller Personal Access Token does not',
    'authenticate the buyer surface, and a buyer OAuth token does not authenticate the',
    "seller's — same human, one account. So each language ships a `seller` and a",
    '`buyer` client, exactly as TypeScript does with `@crossly/sdk` and',
    '`@crossly/buyer-sdk`.',
    '',
    '| language | seller | buyer |',
    '|---|---|---|',
    ...LANGUAGES.map((l) => `| ${l.id} | \`sdks/${l.id}/seller\` | \`sdks/${l.id}/buyer\` |`),
    '',
    '## Where things are',
    '',
    'Each client is one directory, `sdks/<language>/<seller|buyer>`, with its own README.',
    'Inside it:',
    '',
    '| language | API classes | models | API reference pages |',
    '|---|---|---|---|',
    ...LANGUAGES.map((l) => {
      const at = LAYOUT[l.id](packageName(l, APIS[0]), 'seller');
      const c = (p) => (p ? (p.startsWith('`') ? p : `\`${p}\``) : '—');
      return `| ${l.id} | ${c(at.apis)} | ${c(at.models)} | ${c(at.docs)} |`;
    }),
    '',
    '(Seller paths shown; the buyer client swaps in its own package name.)',
    '',
    'Models are grouped one folder per product area — the word after the verb in the',
    'model name, so `GetVaultLendResponse` is under `vault/` — which keeps every',
    'folder under the 1,000 entries GitHub will list. Go, where a folder is a package,',
    'gets one `model_<area>.go` file per area instead.',
    '',
    'There are no per-model doc pages and no generated test stubs: both were',
    'placeholders, two thirds of every client, and buried the code. The spec dedupes',
    'shapes, so a type several endpoints share is ONE model, named after where it',
    'first appears (`GetOrderResponse`, `ListOrdersItem`) or, for small shared shapes',
    'such as `{ ok }`, after its fields (`OkResponse`).',
    '',
    '## Known limits',
    '',
    'Every published operation has a typed response, derived from the TypeScript types',
    'by `derive-response-schemas.mts` (`check-openapi-complete` enforces it). Single',
    'resources come back in the `{ data }` envelope the API actually sends; collections',
    'as `{ data, pagination?, meta? }`. Every method has typed errors.',
    '',
    'Generator is pinned to 5.4.0 (run on Java 8); that line speaks OpenAPI 3.0, which',
    'is why the specs are emitted as 3.0.3.',
    '',
    '## Where generation runs',
    '',
    'On free GitHub Actions in the public `crossly-dev/crossly-sdk-gen` repo: one job per',
    "language and API generates, then compiles the client with that language's own",
    'toolchain (Swift on macOS); only when every job is green does it push each language',
    'to its `crossly-dev/crossly-<language>` mirror. Send it the current specs with',
    '`pnpm sdk:publish-specs` (batched, on release; never per feature).',
    '',
  ].join('\n'),
);

process.exit(failed.length ? 1 : 0);
