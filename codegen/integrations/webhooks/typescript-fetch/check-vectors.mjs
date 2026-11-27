// Runs the shared conformance vectors against the typescript-fetch port (webhooks.ts), twice: the body as the
// string the JSON vectors hold, and as the exact bytes the TSV vectors hold (base64), since a receiver may hand
// the verifier either. Node 22.18+ loads the .ts directly (type stripping).
//
//   node check-vectors.mjs
import { readFileSync } from 'node:fs';

import { verifyWebhook, WebhookVerificationError } from './webhooks.ts';

const here = (p) => new URL(p, import.meta.url);
const { toleranceSeconds, vectors } = JSON.parse(readFileSync(here('../test-vectors.json'), 'utf8'));
const tsv = readFileSync(here('../test-vectors.tsv'), 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [name, body64, header, secret, now, expect] = l.split('\t');
    return { name, body: new Uint8Array(Buffer.from(body64, 'base64')), header, secret, now: Number(now), expect };
  });

let ok = 0;
let bad = 0;
async function run(label, list) {
  for (const v of list) {
    let got;
    try {
      await verifyWebhook(v.body, v.header, v.secret, { nowSeconds: v.now, toleranceSeconds });
      got = 'ok';
    } catch (e) {
      got = e instanceof WebhookVerificationError ? e.reason : `threw ${e}`;
    }
    if (got === v.expect) ok++;
    else {
      bad++;
      console.log(`  MISMATCH ${label} ${v.name}: expected ${v.expect}, got ${got}`);
    }
  }
}
await run('string', vectors);
await run('bytes', tsv);
const failing = vectors.filter((v) => v.expect !== 'ok').length;
if (tsv.length !== vectors.length) {
  console.log(`  MISMATCH: ${vectors.length} JSON vectors but ${tsv.length} TSV vectors`);
  bad++;
}
console.log(`  typescript-fetch: ${ok}/${vectors.length + tsv.length} vectors agree (${vectors.length} each as string and bytes, ${failing} must fail)`);
process.exit(bad ? 1 : 0);
