#!/usr/bin/env node
/**
 * Finish one generated typescript-fetch client after assemble.mjs (which vendored src/crossly.ts,
 * src/webhooks.ts and src/webhooks-middleware.ts into it):
 *
 *   node codegen/integrations/extras/typescript-fetch/finish.mjs <seller|buyer>   (run by codegen/ci/check-typescript-fetch.sh)
 *
 *   1. package.json: npm metadata the 5.4.0 template omits (license, repository, files, engines, provenance),
 *      and a current TypeScript (the template pins ^3.9, which predates the dom lib's AbortSignal.reason).
 *   2. tsconfig.json: ES2019 output (async iterators for paginate) instead of ES5.
 *   3. src/version.ts from package.json; src/index.ts re-exports the vendored modules.
 *
 * Idempotent: ci.yml runs it again over the committed tree and must find nothing to change.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(process.argv[2] ?? '');
const api = basename(dir);
const die = (m) => {
  console.error(`finish.mjs (${api}): ${m}`);
  process.exit(1);
};
if (!['seller', 'buyer'].includes(api) || !existsSync(join(dir, 'package.json'))) die(`${dir} is not a generated client`);
// The vendor list again (assemble.mjs copies it after generation): ci.yml checks the committed tree against the
// CURRENT hand-written files, and a tree generated before they existed has none.
const CODEGEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const v of JSON.parse(readFileSync(join(CODEGEN, 'repo.json'), 'utf8')).vendor ?? []) {
  if (v.to.startsWith(`${api}/`)) copyFileSync(join(CODEGEN, 'integrations', v.from), join(dir, v.to.slice(api.length + 1)));
}
for (const f of ['crossly.ts', 'webhooks.ts', 'webhooks-middleware.ts']) {
  if (!existsSync(join(dir, 'src', f))) die(`src/${f} was not vendored (codegen/repo.json vendor list)`);
}
const put = (rel, text) => {
  const f = join(dir, rel);
  if (!existsSync(f) || readFileSync(f, 'utf8') !== text) writeFileSync(f, text);
};

// 1. package.json
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
const what =
  api === 'seller'
    ? 'your store: listings, crossposting, orders, inventory, analytics'
    : 'shopping: cart, orders, wishlists, offers, cashback';
const out = {
  name: pkg.name,
  version: pkg.version,
  description: `Official Crossly ${api} API client for the Fetch API (Cloudflare Workers, Deno, Bun, Node 18+): ${what}. With webhook verification.`,
  author: 'Crossly',
  license: 'MIT',
  homepage: 'https://crossly.net/docs',
  repository: { type: 'git', url: 'git+https://github.com/crossly-dev/crossly-typescript-fetch.git', directory: api },
  bugs: { url: 'https://github.com/crossly-dev/crossly-typescript-fetch/issues' },
  keywords: ['crossly', 'reselling', 'ecommerce', 'marketplace', 'api', 'sdk', 'fetch', 'cloudflare-workers', 'deno', 'bun'],
  main: pkg.main ?? './dist/index.js',
  typings: pkg.typings ?? './dist/index.d.ts',
  files: ['dist'],
  sideEffects: false,
  engines: { node: '>=18' },
  scripts: { ...pkg.scripts, build: 'tsc', prepare: 'npm run build' },
  devDependencies: { ...pkg.devDependencies, typescript: '5.9.3' },
  publishConfig: { access: 'public', provenance: true },
};
put('package.json', `${JSON.stringify(out, null, 2)}\n`);

// 2. tsconfig.json
const ts = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'));
ts.compilerOptions = { ...ts.compilerOptions, target: 'es2019', lib: ['es2019', 'dom'] };
put('tsconfig.json', `${JSON.stringify(ts, null, 2)}\n`);

// 2b. An operation with two tags is written into BOTH API classes' files, each exporting the same
// `<Op>Request` interface (and param enums), and apis/index.ts `export *`s both: an ambiguous re-export. Keep the
// first file's names and prefix the others' with their class (`InventoryApiGetAnalyticInventoryRequest`).
const apisDir = join(dir, 'src', 'apis');
const owner = new Map();
let renamed = 0;
for (const f of readdirSync(apisDir).filter((n) => n.endsWith('Api.ts')).sort()) {
  const p = join(apisDir, f);
  const before = readFileSync(p, 'utf8');
  let t = before;
  const cls = f.replace(/\.ts$/, '');
  for (const [, name] of [...before.matchAll(/^export (?:interface|const|type|enum) (\w+)/gm)]) {
    if (name === cls) continue;
    if (!owner.has(name)) {
      owner.set(name, f);
      continue;
    }
    if (owner.get(name) === f) continue;
    t = t.replace(new RegExp(`\\b${name}\\b`, 'g'), `${cls}${name}`);
    renamed++;
  }
  if (t !== before) writeFileSync(p, t);
}
if (renamed) console.log(`renamed ${renamed} export(s) duplicated across multi-tag operations`);

// 3. version and exports
put(
  'src/version.ts',
  `// Written by codegen/integrations/extras/typescript-fetch/finish.mjs from package.json.\nexport const SDK_VERSION = '${pkg.version}';\n`,
);
let index = readFileSync(join(dir, 'src', 'index.ts'), 'utf8');
for (const m of ['./version', './crossly', './webhooks', './webhooks-middleware']) {
  const line = `export * from '${m}';`;
  if (!index.includes(line)) index = `${index.trimEnd()}\n${line}\n`;
}
put('src/index.ts', index);
console.log(`finished ${api} (${pkg.name}@${pkg.version})`);
