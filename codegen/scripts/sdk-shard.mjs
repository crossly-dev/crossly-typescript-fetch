/**
 * Group each generated SDK's models into product-area folders.
 *
 * ── WHY ─────────────────────────────────────────────────────────────
 * The seller API has ~2,700 component schemas, and every 5.4.0 generator
 * writes one file per model into ONE folder. GitHub stops listing a
 * directory at 1,000 entries, so on every mirror the models folder showed a
 * truncation notice instead of the code. There is no generator option for
 * model subfolders in this line, so the output is post-processed.
 *
 * ── THE GROUPING ────────────────────────────────────────────────────
 * Model names come from where they appear (`GetVaultLendResponse`,
 * `ListOrdersItem`), so the word after the verb is the product area: vault,
 * world, orders, inventory… Areas are computed from the SPEC, not per
 * language, so all twelve SDKs share one map and one README table. Areas with
 * fewer than MIN_AREA models, and the shared shapes the dedupe pass named
 * from their fields (`OkResponse`, `Pagination`), go to `common`.
 *
 * ── PER LANGUAGE ────────────────────────────────────────────────────
 * Where the language ties a module's path to its import name (python, java,
 * kotlin, php, ruby, rust, dart, typescript) the move rewrites every
 * reference. Where it does not (csharp, swift, elixir) the files only move,
 * so `net.crossly.Model.X` and friends keep their names. Go is the
 * exception: a directory IS a package there, so splitting would change every
 * caller's import path — instead each area's models are merged into one
 * `model_<area>.go` in the same package.
 *
 * Idempotent per run of the generator only: it expects the flat output.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const MIN_AREA = 6;
const VERB = /^(Get|List|Create|Update|Delete)(?=[A-Z0-9])/;
const FIRST_WORD = /^[A-Z0-9][a-z0-9]*/;
const BUYER = /^Buyer(?=[A-Z0-9])/;

/** Words that are keywords in at least one target language; such an area gets an `s`. */
const RESERVED = new Set([
  'abstract',
  'and',
  'as',
  'async',
  'await',
  'base',
  'begin',
  'box',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'data',
  'def',
  'default',
  'del',
  'do',
  'else',
  'end',
  'enum',
  'export',
  'extends',
  'final',
  'fn',
  'for',
  'from',
  'fun',
  'func',
  'global',
  'go',
  'if',
  'impl',
  'import',
  'in',
  'include',
  'interface',
  'is',
  'let',
  'list',
  'loop',
  'map',
  'match',
  'mod',
  'module',
  'move',
  'new',
  'not',
  'object',
  'or',
  'package',
  'pass',
  'pub',
  'raise',
  'range',
  'ref',
  'require',
  'return',
  'select',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'this',
  'throw',
  'trait',
  'try',
  'type',
  'use',
  'val',
  'var',
  'when',
  'where',
  'while',
  'with',
  'yield',
  // Java/Kotlin/Rust/Python hard keywords. `public` (GetPublicTemplate…, 10-22) became the Java package
  // net.crossly.model.public and failed to compile. NOT `print`: an area already, and fine in every target.
  'assert',
  'boolean',
  'byte',
  'char',
  'crate',
  'double',
  'dyn',
  'elif',
  'except',
  'extern',
  'false',
  'finally',
  'float',
  'function',
  'goto',
  'instanceof',
  'int',
  'lambda',
  'long',
  'mut',
  'namespace',
  'native',
  'nonlocal',
  'null',
  'override',
  'priv',
  'private',
  'protected',
  'public',
  'short',
  'strictfp',
  'synchronized',
  'throws',
  'transient',
  'true',
  'typealias',
  'typeof',
  'unsafe',
  'unsized',
  'virtual',
  'void',
  'volatile',
]);

/** Lower-case, alphanumerics only: how a model name is matched to a file in any language's casing. */
export const normName = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * normalised schema name → area, for one spec. Plurals fold into the
 * singular when both occur (`Orders` + `Order` → `order`).
 */
export function modelAreas(specPath) {
  const names = Object.keys(JSON.parse(readFileSync(specPath, 'utf8')).components?.schemas ?? {});
  const wordOf = (name) => {
    const rest = name.replace(VERB, '');
    if (rest === name) return null;
    // Every buyer-API name is `<Verb>Buyer…`, so there the area is the next word.
    return rest.replace(BUYER, '').match(FIRST_WORD)?.[0].toLowerCase() ?? null;
  };
  const words = new Map(names.map((n) => [n, wordOf(n)]));
  const seen = new Set(words.values());
  const fold = (w) => (w && w.endsWith('s') && seen.has(w.slice(0, -1)) ? w.slice(0, -1) : w);
  const counts = new Map();
  for (const [n, w] of words) {
    const f = fold(w);
    words.set(n, f);
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  const areas = new Map();
  for (const [n, w] of words) {
    let area = w && counts.get(w) >= MIN_AREA ? w : 'common';
    if (RESERVED.has(area)) area += 's';
    areas.set(normName(n), area);
  }
  return areas;
}

const pascal = (area) => area[0].toUpperCase() + area.slice(1);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

function rewriteAll(files, fn) {
  for (const file of files) {
    const before = readFileSync(file, 'utf8');
    const after = fn(before, file);
    if (after !== before) writeFileSync(file, after);
  }
}

/**
 * Move every model file in `dir` (flat, extension `ext`) into
 * `dir/<folder(area)>/`. Returns stem → folder for the files that moved;
 * files that are not models (index.ts, mod.rs, ModelInterface.php…) stay.
 */
function moveModels(dir, ext, areas, folder = (a) => a) {
  const moved = new Map();
  for (const name of readdirSync(dir)) {
    if (extname(name) !== ext) continue;
    const stem = basename(name, ext);
    const area = areas.get(normName(stem));
    if (!area) continue;
    const sub = folder(area);
    mkdirSync(join(dir, sub), { recursive: true });
    renameSync(join(dir, name), join(dir, sub, name));
    moved.set(stem, sub);
  }
  return moved;
}

/** The single subdirectory of `root` that contains `child` (python/ruby package dirs). */
function packageDirWith(root, child) {
  return readdirSync(root, { withFileTypes: true }).find(
    (e) => e.isDirectory() && existsSync(join(root, e.name, child)),
  )?.name;
}

// ── languages ──────────────────────────────────────────────────────

function typescript(root, areas) {
  const dir = join(root, 'src', 'models');
  const moved = moveModels(dir, '.ts', areas);
  const target = (from, stem) => {
    const sub = moved.get(stem);
    if (from === null) return sub ? `./${sub}/${stem}` : `./${stem}`;
    return sub === from ? `./${stem}` : sub ? `../${sub}/${stem}` : `../${stem}`;
  };
  for (const [stem, sub] of moved) {
    const file = join(dir, sub, `${stem}.ts`);
    const text = readFileSync(file, 'utf8')
      .replace(/from '\.\.\/runtime'/g, "from '../../runtime'")
      .replace(/from '\.\/([\w]+)'/g, (_, s) => `from '${target(sub, s)}'`);
    writeFileSync(file, text);
  }
  // index.ts and any model the area map did not place (a name the generator
  // changed, like `Error` → `ModelError`) stay at the root and import from there.
  const rootFiles = readdirSync(dir)
    .filter((n) => n.endsWith('.ts'))
    .map((n) => join(dir, n));
  rewriteAll(rootFiles, (t) => t.replace(/from '\.\/([\w]+)'/g, (_, s) => `from '${target(null, s)}'`));
  return moved.size;
}

function python(root, areas) {
  const pkg = packageDirWith(root, 'model');
  const dir = join(root, pkg, 'model');
  const moved = moveModels(dir, '.py', areas);
  for (const sub of new Set(moved.values())) writeFileSync(join(dir, sub, '__init__.py'), '');
  const ref = new RegExp(`\\b${esc(pkg)}\\.model\\.(\\w+)\\b`, 'g');
  rewriteAll([...walk(join(root, pkg), ['.py']), ...walk(root, ['.md'])], (t) =>
    t.replace(ref, (whole, stem) => (moved.has(stem) ? `${pkg}.model.${moved.get(stem)}.${stem}` : whole)),
  );
  return moved.size;
}

function ruby(root, areas) {
  const gem = packageDirWith(join(root, 'lib'), 'models');
  const dir = join(root, 'lib', gem, 'models');
  const moved = moveModels(dir, '.rb', areas);
  const ref = new RegExp(`'${esc(gem)}/models/(\\w+)'`, 'g');
  rewriteAll([join(root, 'lib', `${gem}.rb`)], (t) =>
    t.replace(ref, (whole, stem) => (moved.has(stem) ? `'${gem}/models/${moved.get(stem)}/${stem}'` : whole)),
  );
  return moved.size;
}

function dart(root, areas) {
  const dir = join(root, 'lib', 'model');
  const moved = moveModels(dir, '.dart', areas);
  rewriteAll(
    walk(join(root, 'lib'), ['.dart']).filter((f) => !f.startsWith(dir)),
    (t) =>
      t.replace(/part 'model\/(\w+)\.dart';/g, (whole, stem) =>
        moved.has(stem) ? `part 'model/${moved.get(stem)}/${stem}.dart';` : whole,
      ),
  );
  return moved.size;
}

/**
 * Rust: one module per area (`models/vault/mod.rs`), re-exported with a glob,
 * so `crate::models::X` — which every generated file uses — still resolves.
 */
function rust(root, areas) {
  const dir = join(root, 'src', 'models');
  const lines = readFileSync(join(dir, 'mod.rs'), 'utf8').split('\n');
  const moved = moveModels(
    dir,
    '.rs',
    (() => {
      const m = new Map(areas);
      m.delete('mod');
      return m;
    })(),
  );
  const byArea = new Map();
  const top = [];
  for (let i = 0; i < lines.length; i++) {
    const mod = lines[i].match(/^pub mod (\w+);$/)?.[1];
    if (mod && moved.has(mod)) {
      const area = moved.get(mod);
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push(lines[i]);
      if (/^pub use self::/.test(lines[i + 1] ?? '')) byArea.get(area).push(lines[++i]);
    } else top.push(lines[i]);
  }
  for (const [area, body] of byArea) writeFileSync(join(dir, area, 'mod.rs'), `${body.join('\n')}\n`);
  const areaMods = [...byArea.keys()].sort().flatMap((a) => [`pub mod ${a};`, `pub use self::${a}::*;`]);
  writeFileSync(join(dir, 'mod.rs'), `${[...areaMods, ...top].join('\n').trimEnd()}\n`);
  return moved.size;
}

/**
 * Java and Kotlin: each area becomes a sub-package (`net.crossly.model.vault`).
 * Fully-qualified references are rewritten; a moved file then imports every
 * model it names that now lives in another package, and a wildcard import of
 * the old package is widened to every area.
 */
function jvm(root, areas, { lang, modelPkgDir }) {
  const srcRoot = join(root, 'src', 'main', lang);
  const dir = join(srcRoot, ...modelPkgDir.split('/'));
  const basePkg = modelPkgDir.replace(/\//g, '.');
  const ext = lang === 'java' ? '.java' : '.kt';
  const semi = lang === 'java' ? ';' : '';
  const unmoved = readdirSync(dir)
    .filter((n) => extname(n) === ext)
    .map((n) => basename(n, ext));
  const moved = moveModels(dir, ext, areas);
  const pkgOf = (cls) => (moved.has(cls) ? `${basePkg}.${moved.get(cls)}` : basePkg);
  const fq = new RegExp(`\\b${esc(basePkg)}\\.([A-Z]\\w*)\\b`, 'g');
  const wildcard = new RegExp(`^import ${esc(basePkg)}\\.\\*${semi}\\s*$`, 'm');
  const allAreas = [...new Set(moved.values())].sort();
  const classes = new Set([...unmoved]);
  rewriteAll([...walk(srcRoot, [ext]), ...walk(root, ['.md'])], (text, file) => {
    let t = text.replace(fq, (whole, cls) => (classes.has(cls) ? `${pkgOf(cls)}.${cls}` : whole));
    t = t.replace(
      wildcard,
      (line) => [line.trimEnd(), ...allAreas.map((a) => `import ${basePkg}.${a}.*${semi}`)].join('\n') + '\n',
    );
    const self = basename(file, ext);
    if (!file.startsWith(dir) || !moved.has(self)) return t;
    const own = pkgOf(self);
    t = t.replace(new RegExp(`^package ${esc(basePkg)}${semi}?$`, 'm'), `package ${own}${semi}`);
    const imported = new Set([...t.matchAll(/^import ([\w.]+)/gm)].map((m) => m[1]));
    const wanted = new Set();
    for (const m of t.matchAll(/\b[A-Z]\w*\b/g)) {
      const cls = m[0];
      if (cls === self || !classes.has(cls) || pkgOf(cls) === own) continue;
      const full = `${pkgOf(cls)}.${cls}`;
      if (!imported.has(full)) wanted.add(full);
    }
    if (!wanted.size) return t;
    const add = [...wanted]
      .sort()
      .map((w) => `import ${w}${semi}`)
      .join('\n');
    return t.replace(/^(package [\w.]+;?\s*\n)/m, `$1\n${add}\n`);
  });
  return moved.size;
}

/**
 * PHP: each area is a sub-namespace (`Crossly\Model\Vault`) in a matching
 * folder, so PSR-4 autoloading keeps working with no composer change. Model
 * class names appear as escaped strings (`'\\Crossly\\Model\\X'`) as well as
 * in code, so the rewrite matches any run of backslashes.
 */
function php(root, areas) {
  const dir = join(root, 'lib', 'Model');
  const ns = JSON.parse(readFileSync(join(root, 'composer.json'), 'utf8')).autoload['psr-4'];
  const rootNs = Object.keys(ns)[0].replace(/\\+$/, '');

  const moved = moveModels(dir, '.php', areas, pascal);
  const segs = rootNs.split('\\');
  // Group 1 is the leading backslash run; every later separator must repeat it.
  const ref = new RegExp(`(\\\\+)${segs.map(esc).join('\\1')}\\1Model\\1([A-Z]\\w*)\\b`, 'g');
  const bare = new RegExp(`\\b${segs.map(esc).join('\\\\')}\\\\Model\\\\([A-Z]\\w*)\\b`, 'g');
  rewriteAll([...walk(join(root, 'lib'), ['.php']), ...walk(root, ['.md'])], (text, file) => {
    let t = text.replace(ref, (whole, run, cls) =>
      moved.has(cls) ? `${run}${segs.join(run)}${run}Model${run}${moved.get(cls)}${run}${cls}` : whole,
    );
    t = t.replace(bare, (whole, cls) => (moved.has(cls) ? `${rootNs}\\Model\\${moved.get(cls)}\\${cls}` : whole));
    const self = basename(file, '.php');
    if (!file.startsWith(dir) || !moved.has(self)) return t;
    return t.replace(
      /^namespace ([\w\\]+)\\Model;\s*$/m,
      (_, r) => `namespace ${r}\\Model\\${moved.get(self)};\n\nuse \\${r}\\Model\\ModelInterface;`,
    );
  });
  return moved.size;
}

/**
 * Go: merge each area's `model_*.go` files into `model_<area>.go`, same
 * package. A big area is cut into `model_<area>_01.go`, `_02`… at GO_FILE_BYTES:
 * the vault area merged whole is ~8 MB, which GitHub will not display and
 * editors choke on — the opposite of what this is for.
 */
const GO_FILE_BYTES = 400_000;

function go(root, areas) {
  const files = readdirSync(root).filter((n) => /^model_\w+\.go$/.test(n));
  const byArea = new Map();
  for (const name of files) {
    const area = areas.get(normName(name.slice('model_'.length, -'.go'.length)));
    if (!area) continue;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area).push(name);
  }
  let count = 0;
  for (const [area, names] of byArea) {
    let header = '';
    let pkgLine = '';
    const parts = [];
    for (const name of names.sort()) {
      const text = readFileSync(join(root, name), 'utf8');
      const pkgAt = text.search(/^package \w+/m);
      if (!header) header = text.slice(0, pkgAt);
      let rest = text.slice(pkgAt);
      pkgLine = rest.match(/^package \w+/)[0];
      rest = rest.slice(pkgLine.length);
      const imports = [];
      rest = rest.replace(/^\s*import \(\n([\s\S]*?)\n\)\n/, (_, block) => {
        for (const l of block.split('\n')) if (l.trim()) imports.push(l.trim());
        return '\n';
      });
      rest = rest.replace(/^\s*import ("[^"\n]+")\n/, (_, one) => {
        imports.push(one);
        return '\n';
      });
      parts.push({ imports, body: rest.trim() });
      rmSync(join(root, name));
      count++;
    }
    const chunks = [[]];
    let size = 0;
    for (const part of parts) {
      if (size > 0 && size + part.body.length > GO_FILE_BYTES) {
        chunks.push([]);
        size = 0;
      }
      chunks[chunks.length - 1].push(part);
      size += part.body.length;
    }
    chunks.forEach((chunk, i) => {
      const imports = [...new Set(chunk.flatMap((p) => p.imports))].sort();
      const block = imports.length ? `import (\n${imports.map((l) => `\t${l}`).join('\n')}\n)\n\n` : '';
      const suffix = chunks.length > 1 ? `_${String(i + 1).padStart(2, '0')}` : '';
      const body = chunk.map((p) => p.body).join('\n\n');
      writeFileSync(join(root, `model_${area}${suffix}.go`), `${header}${pkgLine}\n\n${block}${body}\n`);
    });
  }
  return count;
}

/** Languages whose module names are not tied to file paths: the files just move. */
const moveOnly = (rel, ext, folder) => (root, areas) => moveModels(join(root, ...rel(root)), ext, areas, folder);

const csharpDir = (root) => {
  const src = join(root, 'src');
  const proj = readdirSync(src).find((n) => existsSync(join(src, n, 'Model')));
  return ['src', proj, 'Model'];
};
const swiftDir = (root) => {
  const proj = readdirSync(root).find((n) => existsSync(join(root, n, 'Classes', 'OpenAPIs', 'Models')));
  return [proj, 'Classes', 'OpenAPIs', 'Models'];
};
const elixirDir = (root) => [
  'lib',
  readdirSync(join(root, 'lib')).find((n) => existsSync(join(root, 'lib', n, 'model'))),
  'model',
];

const HANDLERS = {
  'typescript-fetch': typescript,
  python,
  ruby,
  dart,
  rust,
  php,
  go,
  java: (root, areas) => {
    const base = walk(join(root, 'src', 'main', 'java'), ['.java'])
      .map((f) => f.replace(/\\/g, '/').match(/src\/main\/java\/(.+\/model)\/[^/]+\.java$/)?.[1])
      .find(Boolean);
    return jvm(root, areas, { lang: 'java', modelPkgDir: base });
  },
  kotlin: (root, areas) => {
    const base = walk(join(root, 'src', 'main', 'kotlin'), ['.kt'])
      .map((f) => f.replace(/\\/g, '/').match(/src\/main\/kotlin\/(.+\/models)\/[^/]+\.kt$/)?.[1])
      .find(Boolean);
    return jvm(root, areas, { lang: 'kotlin', modelPkgDir: base });
  },
  csharp: moveOnly(csharpDir, '.cs', pascal),
  swift: moveOnly(swiftDir, '.swift', pascal),
  elixir: moveOnly(elixirDir, '.ex'),
};

/** Group one generated client's models. Returns how many model files moved (or merged, for Go). */
export function shardModels(langId, clientDir, areas) {
  const handler = HANDLERS[langId];
  return handler ? handler(clientDir, areas) : 0;
}

/** Folder name of an area in a language — PascalCase where the language's own folders are. */
export function areaFolder(langId, area) {
  return ['php', 'csharp', 'swift'].includes(langId) ? pascal(area) : area;
}
