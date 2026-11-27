#!/usr/bin/env node
/**
 * Decide the next version from what changed in the specs, and write the CHANGELOG entry for it.
 *
 *   node codegen/ci/next-version.mjs          (after fetch-specs.mjs)
 *
 * Compares each fresh spec against codegen/index/<api>.json, a compact fingerprint of the spec this repo last
 * generated from: one hash per operation (method + path) and one per component schema. Then:
 *
 *   operation or schema REMOVED   breaking   0.x: minor bump (0.4.2 -> 0.5.0); >=1.0: major
 *   anything added or changed     additive   patch bump
 *   first run (no index)          keeps codegen/state.json's version (the first release)
 *
 * A changed operation or schema may be breaking too (a new required field); the entry lists them by name so a
 * reader can see which, and the bump stays conservative only where a removal makes it certain.
 *
 * Writes codegen/index/*.json, codegen/state.json (version + spec shas), prepends CHANGELOG.md, writes
 * codegen/release-notes.md (this release's entry, for the GitHub Release), and `version=` / `tag=` to
 * $GITHUB_OUTPUT.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODEGEN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CODEGEN, '..');
const APIS = ['seller', 'buyer'];
const METHODS = ['get', 'put', 'post', 'delete', 'patch'];
const LIST_CAP = 60;

const read = (p, dflt) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : dflt);
const hash = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12);

function fingerprint(spec) {
  const ops = {};
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const m of METHODS) {
      if (!item[m]) continue;
      const { summary: _s, description: _d, ...shape } = item[m];
      ops[`${m.toUpperCase()} ${path}`] = { id: item[m].operationId ?? null, sig: hash(shape) };
    }
  }
  const schemas = {};
  for (const [name, s] of Object.entries(spec.components?.schemas ?? {})) schemas[name] = hash(s);
  return { ops, schemas };
}

function diff(before, after) {
  const d = { opsAdded: [], opsRemoved: [], opsChanged: [], schemasAdded: [], schemasRemoved: [], schemasChanged: [] };
  for (const [k, v] of Object.entries(after.ops)) {
    if (!before.ops[k]) d.opsAdded.push(k);
    else if (before.ops[k].sig !== v.sig) d.opsChanged.push(k);
  }
  for (const k of Object.keys(before.ops)) if (!after.ops[k]) d.opsRemoved.push(k);
  for (const [k, v] of Object.entries(after.schemas)) {
    if (!(k in before.schemas)) d.schemasAdded.push(k);
    else if (before.schemas[k] !== v) d.schemasChanged.push(k);
  }
  for (const k of Object.keys(before.schemas)) if (!(k in after.schemas)) d.schemasRemoved.push(k);
  for (const list of Object.values(d)) list.sort();
  return d;
}

function bump(v, level) {
  const [maj, min, pat] = v.split('-')[0].split('.').map(Number);
  if (level === 'breaking') return maj === 0 ? `0.${min + 1}.0` : `${maj + 1}.0.0`;
  if (level === 'additive') return `${maj}.${min}.${pat + 1}`;
  return v;
}

const state = read(join(CODEGEN, 'state.json'), { version: '0.1.0', specs: {} });
const shas = read(join(CODEGEN, 'specs', 'shas.json'), null);
if (!shas) {
  console.error('run fetch-specs.mjs first');
  process.exit(2);
}

let level = 'none';
let firstRun = false;
const sections = [];
mkdirSync(join(CODEGEN, 'index'), { recursive: true });
for (const api of APIS) {
  const spec = JSON.parse(readFileSync(join(CODEGEN, 'specs', `${api}.json`), 'utf8'));
  const after = fingerprint(spec);
  const idxPath = join(CODEGEN, 'index', `${api}.json`);
  const before = read(idxPath, null);
  writeFileSync(idxPath, `${JSON.stringify(after, null, 1)}\n`);
  if (!before) {
    firstRun = true;
    sections.push(`### ${api}\n\nFirst release from this repo: ${Object.keys(after.ops).length} operations, ${Object.keys(after.schemas).length} models.`);
    continue;
  }
  const d = diff(before, after);
  if (d.opsRemoved.length || d.schemasRemoved.length) level = 'breaking';
  else if (level !== 'breaking' && Object.values(d).some((l) => l.length)) level = 'additive';
  const label = (op) => (after.ops[op]?.id || before.ops[op]?.id ? `\`${after.ops[op]?.id ?? before.ops[op].id}\` (${op})` : op);
  const block = (title, items, fmt = (x) => `\`${x}\``) =>
    items.length
      ? [`**${title}** (${items.length})`, '', ...items.slice(0, LIST_CAP).map((x) => `- ${fmt(x)}`), ...(items.length > LIST_CAP ? [`- … and ${items.length - LIST_CAP} more`] : []), '']
      : [];
  const lines = [
    ...block('Removed operations (breaking)', d.opsRemoved, label),
    ...block('Removed models (breaking)', d.schemasRemoved),
    ...block('New operations', d.opsAdded, label),
    ...block('Changed operations', d.opsChanged, label),
    ...block('New models', d.schemasAdded),
    ...block('Changed models', d.schemasChanged),
  ];
  sections.push(`### ${api}\n\n${lines.length ? lines.join('\n').trimEnd() : 'No API changes (regenerated).'}`);
}

const version = firstRun ? state.version : bump(state.version, level === 'none' ? 'additive' : level);
const date = new Date().toISOString().slice(0, 10);
const entry = [
  `## ${version} (${date})`,
  '',
  `Generated from the Crossly API specs: seller \`${shas.seller.slice(0, 9)}\`, buyer \`${shas.buyer.slice(0, 9)}\`.${level === 'breaking' ? ' **Contains breaking changes.**' : ''}`,
  '',
  sections.join('\n\n'),
  '',
].join('\n');

const changelogPath = join(REPO, 'CHANGELOG.md');
const head = '# Changelog\n\nEvery release is generated from the public Crossly OpenAPI specs; each entry lists what changed in them.\n\n';
// Keep every earlier entry: everything from the first `## ` heading on.
const prior = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
const at = prior.search(/^## /m);
const old = at >= 0 ? prior.slice(at) : '';
writeFileSync(changelogPath, `${head}${entry}\n${old.trimStart()}`.trimEnd() + '\n');
writeFileSync(join(CODEGEN, 'release-notes.md'), entry);
writeFileSync(join(CODEGEN, 'state.json'), `${JSON.stringify({ version, specs: shas }, null, 2)}\n`);

console.log(`version ${state.version} -> ${version} (${firstRun ? 'first release' : level})`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`);
