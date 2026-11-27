/**
 * Where things are inside each generated SDK, and the markdown tidy-up that
 * follows generation. Shared by `generate-sdks.mjs` (per-client READMEs and
 * `sdks/README.md`) and `sync-public-mirrors.mjs` (each mirror's root README).
 *
 * ── WHY THE TIDY-UP EXISTS ───────────────────────────────────────────
 * The generators are run with `modelDocs=false` (see generate-sdks.mjs): a
 * doc page per model was ~2,700 near-empty files per client, more than the
 * models themselves. But the 5.4.0 templates still write a README listing
 * every model as a link to its (now absent) page, and every API page links
 * its parameter and return types to them. Rather than fork twelve template
 * sets, the output is post-processed: the README's model list becomes a short
 * "Where things are" section, and a link to a page that does not exist is
 * reduced to its text. Links that resolve are left alone.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * The package name each generator is given: `crossly` / `crossly_buyer` —
 * snake for the languages that want it. Lives here because the mirror sync
 * needs it too, for the per-repo README.
 */
export function sdkPackageName(langId, apiId) {
  const base = apiId === 'buyer' ? 'crossly_buyer' : 'crossly';
  if (langId === 'java' || langId === 'csharp') {
    return apiId === 'buyer' ? 'net.crossly.buyer' : 'net.crossly';
  }
  if (langId === 'ruby') return apiId === 'buyer' ? 'crossly_buyer' : 'crossly';
  if (langId === 'kotlin') return apiId === 'buyer' ? 'net.crossly.buyer' : 'net.crossly';
  if (langId === 'swift') return apiId === 'buyer' ? 'CrosslyBuyer' : 'Crossly';
  if (langId === 'dart') return apiId === 'buyer' ? 'crossly_buyer' : 'crossly';
  if (langId === 'typescript-fetch') return apiId === 'buyer' ? '@crossly/buyer-fetch' : '@crossly/fetch';
  if (langId === 'php') return apiId === 'buyer' ? 'Crossly\\Buyer' : 'Crossly';
  return base;
}

const slash = (pkg) => pkg.replace(/\./g, '/');

/**
 * Per language: where the API classes, the models and the API docs live,
 * relative to one client's root (`sdks/<lang>/<seller|buyer>`). `pkg` is the
 * package name generate-sdks.mjs passes; `api` is `seller` or `buyer`.
 *
 * Models sit one folder per product area (see sdk-shard.mjs). Go is the
 * exception: in Go a directory IS a package, so its areas are files —
 * `model_vault.go`, `model_orders.go` — in the one package.
 */
export const LAYOUT = {
  python: (pkg) => ({ apis: `${pkg}/api/`, models: `${pkg}/model/<area>/`, docs: 'docs/' }),
  php: () => ({ apis: 'lib/Api/', models: 'lib/Model/<Area>/', docs: 'docs/Api/' }),
  go: () => ({ apis: '`api_*.go` (package root)', models: '`model_<area>.go` (package root)', docs: 'docs/' }),
  ruby: (pkg) => ({ apis: `lib/${pkg}/api/`, models: `lib/${pkg}/models/<area>/`, docs: 'docs/' }),
  java: (pkg) => ({
    apis: `src/main/java/${slash(pkg)}/api/`,
    models: `src/main/java/${slash(pkg)}/model/<area>/`,
    docs: 'docs/',
  }),
  csharp: (pkg) => ({ apis: `src/${pkg}/Api/`, models: `src/${pkg}/Model/<Area>/`, docs: 'docs/' }),
  rust: () => ({ apis: 'src/apis/', models: 'src/models/<area>/', docs: 'docs/' }),
  kotlin: (pkg) => ({
    apis: `src/main/kotlin/${slash(pkg)}/apis/`,
    models: `src/main/kotlin/${slash(pkg)}/models/<area>/`,
    docs: 'docs/',
  }),
  swift: (pkg) => ({ apis: `${pkg}/Classes/OpenAPIs/APIs/`, models: `${pkg}/Classes/OpenAPIs/Models/<Area>/`, docs: 'docs/' }),
  dart: () => ({ apis: 'lib/api/', models: 'lib/model/<area>/', docs: 'doc/' }),
  'typescript-fetch': () => ({ apis: 'src/apis/', models: 'src/models/<area>/', docs: null }),
  // The elixir generator names its module after the spec title, not packageName.
  elixir: (_pkg, api) => ({
    apis: `lib/crossly_${api}_api/api/`,
    models: `lib/crossly_${api}_api/model/<area>/`,
    docs: null,
  }),
};

const code = (p) => (p.startsWith('`') ? p : `\`${p}\``);

/** The "Where things are" section for one client, as markdown lines. */
export function whereThingsAre(langId, apiId, pkg) {
  const l = LAYOUT[langId]?.(pkg, apiId);
  if (!l) return [];
  return [
    '## Where things are',
    '',
    '| what | where |',
    '|---|---|',
    `| one class per API group (\`OrdersApi\`, \`ListingsApi\`, …) | ${code(l.apis)} |`,
    `| one model per response/request type, grouped by product area | ${code(l.models)} |`,
    ...(l.docs ? [`| a reference page per API group, every method with an example | ${code(l.docs)} |`] : []),
    '',
    'The area is the word after the verb in the model name: `GetVaultLendResponse`',
    'is under `vault`, `ListOrdersItem` under `order`. Areas with only a handful of',
    'models, and small shared shapes, are under `common`.',
    '',
    'Models are named after where they appear: `GetOrderResponse` is what `getOrder`',
    'returns, `GetOrderResponseDataLines` the type of its `data.lines`, `ListOrdersItem`',
    'one row of `listOrders`. A type several endpoints share appears ONCE, under the',
    'first name it was given — or, for small shared shapes like `{ ok }`, a name from',
    'its fields (`OkResponse`). There is no per-model doc page: the model source file',
    'is the reference, and your editor will jump to it.',
    '',
  ];
}

function walkMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkMarkdown(p, out);
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

const MODEL_SECTION = /^## Documentation [Ff]or Models[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m;
const LINK = /\[([^\]]*)\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/g;
const BACK_TO_MODELS = /\s*\[\[Back to Model list\]\]\([^)]*\)/g;

/**
 * Post-process one generated client: replace the README's model list with
 * `section` (lines), and reduce links to markdown pages that do not exist to
 * their text. Returns how many links were reduced.
 */
export function tidyGeneratedDocs(clientDir, section) {
  let reduced = 0;
  for (const file of walkMarkdown(clientDir)) {
    const before = readFileSync(file, 'utf8');
    let text = before;
    if (resolve(file) === resolve(clientDir, 'README.md') && section.length && !text.includes(section[0])) {
      text = MODEL_SECTION.test(text)
        ? text.replace(MODEL_SECTION, `${section.join('\n')}\n`)
        : `${text.trimEnd()}\n\n${section.join('\n')}\n`;
    }
    text = text.replace(BACK_TO_MODELS, '');
    text = text.replace(LINK, (whole, label, target) => {
      if (/^[a-z]+:/i.test(target)) return whole;
      if (existsSync(resolve(dirname(file), target))) return whole;
      reduced += 1;
      return label;
    });
    if (text !== before) writeFileSync(file, text);
  }
  return reduced;
}

/**
 * The same, for a mirror repo's root README, which holds both clients as
 * `seller/` and `buyer/`.
 */
export function mirrorWhereThingsAre(langId) {
  const rows = [];
  for (const api of ['seller', 'buyer']) {
    const l = LAYOUT[langId]?.(sdkPackageName(langId, api), api);
    if (!l) return [];
    const at = (p) => (p.startsWith('`') ? `\`${api}/\` ${p}` : `\`${api}/${p}\``);
    rows.push(`| ${api} | ${at(l.apis)} | ${at(l.models)} | ${l.docs ? at(l.docs) : '—'} |`);
  }
  return [
    '## Where things are',
    '',
    '| client | API classes | models | API reference pages |',
    '|---|---|---|---|',
    ...rows,
    '',
    'One class per API group (`OrdersApi`, `ListingsApi`, …), one model per type, the',
    'models grouped one folder per product area (`vault`, `world`, `order`, …). A type',
    'several endpoints share is ONE model, named after where it first appears',
    '(`GetOrderResponse`, `ListOrdersItem`) or, for small shared shapes such as `{ ok }`,',
    'after its fields (`OkResponse`). Each client README lists every method.',
    '',
  ];
}

/**
 * The root README of a generated-SDK mirror (`crossly-dev/crossly-<lang>`),
 * which holds `seller/`, `buyer/` and `webhooks/`. Written by the
 * crossly-sdk-gen workflow (ci/assemble-mirror.mjs) when it pushes a mirror;
 * `source` is the Crossly commit the specs were emitted from.
 */
export function mirrorReadme(langId, source) {
  return [
    `# Crossly ${langId} SDK`,
    '',
    '> **Generated.** Source of truth is the OpenAPI spec in the Crossly monorepo, published',
    '> to [crossly-dev/crossly-sdk-gen](https://github.com/crossly-dev/crossly-sdk-gen), which',
    "> generates, compiles and pushes this repo. Pull requests editing this code can't be",
    '> merged — open an issue, the spec gets fixed, the client regenerates.',
    '',
    '## Two clients, two principals',
    '',
    '| directory | API | credential |',
    '|---|---|---|',
    '| `seller/` | store: listings, crossposting, orders, analytics | Personal Access Token (`crossly_pat_…`) or seller OAuth |',
    '| `buyer/` | shopping: cart, orders, wishlists, offers, cashback | buyer OAuth (`crossly_oat_…`), `buyer:*` scopes |',
    '',
    'They are **not** interchangeable. A seller token does not authenticate the buyer',
    'API and vice versa — same person, one Crossly account, two principals. Using the',
    'wrong one gives you a 401 from a subsystem that will not explain why.',
    '',
    '`webhooks/` holds the hand-written webhook signature verifier for this language and',
    'the shared test vectors it is checked against.',
    '',
    ...mirrorWhereThingsAre(langId),
    '## Money is always cents',
    '',
    'Every amount is an integer number of cents (`amountCents`, `totalCents`).',
    'There are no float dollars anywhere in this API.',
    '',
    '## Status',
    '',
    'Every method returns a typed model. Collection endpoints return',
    '`{ data, pagination?, meta? }` with a typed item model; single resources return',
    'the `{ data }` envelope the API actually sends. Errors are typed everywhere.',
    '',
    `_Generated from the Crossly OpenAPI specs at ${source}._`,
    '',
    '## License',
    '',
    'MIT',
    '',
  ].join('\n');
}
