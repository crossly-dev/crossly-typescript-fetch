#!/usr/bin/env node
/**
 * Download the public Crossly OpenAPI specs and say whether they changed since this repo last generated.
 *
 *   node codegen/ci/fetch-specs.mjs            writes codegen/specs/{seller,buyer}.json (gitignored)
 *
 * Change = a different sha256 of the spec's canonical JSON (keys sorted) than codegen/state.json records, so a
 * re-serialisation that reorders keys is not a release. FORCE=true reports a change regardless.
 * Writes `changed=true|false` and `seller=<sha9>` / `buyer=<sha9>` to $GITHUB_OUTPUT when it is set.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODEGEN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.CROSSLY_OPENAPI_BASE || 'https://crossly.net/openapi';
const APIS = ['seller', 'buyer'];

const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
      : v;

const state = existsSync(join(CODEGEN, 'state.json')) ? JSON.parse(readFileSync(join(CODEGEN, 'state.json'), 'utf8')) : {};
mkdirSync(join(CODEGEN, 'specs'), { recursive: true });

const out = {};
let changed = process.env.FORCE === 'true';
for (const api of APIS) {
  const res = await fetch(`${BASE}/${api}.json`, { headers: { Accept: 'application/json', 'User-Agent': 'crossly-sdk-regen' } });
  if (!res.ok) {
    console.error(`${BASE}/${api}.json: HTTP ${res.status}`);
    process.exit(1);
  }
  const text = await res.text();
  const spec = JSON.parse(text);
  if (!spec.openapi || !spec.paths) {
    console.error(`${api}: not an OpenAPI document`);
    process.exit(1);
  }
  writeFileSync(join(CODEGEN, 'specs', `${api}.json`), text);
  const sha = createHash('sha256').update(JSON.stringify(canonical(spec))).digest('hex');
  out[api] = sha;
  const was = state.specs?.[api];
  console.log(`${api}: ${Object.keys(spec.paths).length} paths, sha ${sha.slice(0, 9)}${was === sha ? ' (unchanged)' : was ? ` (was ${was.slice(0, 9)})` : ' (first run)'}`);
  if (was !== sha) changed = true;
}

writeFileSync(join(CODEGEN, 'specs', 'shas.json'), JSON.stringify(out, null, 2));
console.log(changed ? 'specs changed: regenerating' : 'specs unchanged: nothing to release');
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `changed=${changed}\nseller=${out.seller.slice(0, 9)}\nbuyer=${out.buyer.slice(0, 9)}\n`,
  );
}
