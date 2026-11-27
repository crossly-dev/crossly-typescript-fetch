#!/usr/bin/env node
// Exercises the hand-written layer against the BUILT client (dist/), as a consumer would load it:
//
//   node codegen/integrations/extras/typescript-fetch/smoke.mjs <seller|buyer>    (after `tsc`, from check-typescript-fetch.sh)
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const sdk = createRequire(join(dir, 'package.json'))(join(dir, 'dist', 'index.js'));
const { createConfiguration, crosslyFetch, CrosslyError, paginate, USER_AGENT, SDK_VERSION } = sdk;
const { webhookHandler, honoWebhook, verifyWebhook } = sdk;
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
};

const json = (status, body, headers = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

await test('User-Agent carries the package version', () => {
  assert.equal(USER_AGENT, `crossly-typescript-fetch/${SDK_VERSION}`);
  assert.match(SDK_VERSION, /^\d+\.\d+\.\d+/);
});

await test('retries 429 (Retry-After) and 503 with one Idempotency-Key, then succeeds', async () => {
  const seen = [];
  const answers = [json(429, { error: { code: 'rate_limited' } }, { 'retry-after': '0' }), json(503, {}), json(201, { ok: true })];
  const f = crosslyFetch({
    token: 'crossly_pat_test',
    baseBackoffMs: 1,
    fetch: async (_url, init) => {
      const h = new Headers(init.headers);
      seen.push({ key: h.get('idempotency-key'), ua: h.get('user-agent'), auth: h.get('authorization'), body: init.body });
      return answers.shift();
    },
  });
  const res = await f('https://example.test/v1/x', { method: 'POST', body: '{"a":1}' });
  assert.equal(res.status, 201);
  assert.equal(seen.length, 3);
  assert.ok(seen[0].key);
  assert.ok(seen.every((s) => s.key === seen[0].key && s.body === '{"a":1}'));
  assert.equal(seen[0].ua, USER_AGENT);
  assert.equal(seen[0].auth, 'Bearer crossly_pat_test');
});

await test('a long Retry-After is not waited out: one call, typed error', async () => {
  let calls = 0;
  const f = crosslyFetch({
    fetch: async () => {
      calls++;
      return json(429, { error: { code: 'rate_limited', message: 'slow down' }, correlationId: 'c_1' }, { 'retry-after': '3600' });
    },
  });
  const err = await f('https://example.test/v1/x').then(() => null, (e) => e);
  assert.ok(err instanceof CrosslyError);
  assert.equal(calls, 1);
  assert.equal(err.code, 'rate_limited');
  assert.equal(err.status, 429);
  assert.equal(err.retryAfterSeconds, 3600);
  assert.equal(err.correlationId, 'c_1');
});

await test('a 404 is not retried and reads the error envelope', async () => {
  let calls = 0;
  const f = crosslyFetch({
    fetch: async () => {
      calls++;
      return json(404, { error: { code: 'not_found', message: 'No such listing', details: { id: 'x' } }, correlationId: 'c_2' });
    },
  });
  const err = await f('https://example.test/v1/listings/x').then(() => null, (e) => e);
  assert.equal(calls, 1);
  assert.deepEqual([err.code, err.message, err.correlationId, err.details], ['not_found', 'No such listing', 'c_2', { id: 'x' }]);
});

await test('a POST without a key is not retried on 503', async () => {
  let calls = 0;
  const f = crosslyFetch({ idempotencyKeys: false, baseBackoffMs: 1, fetch: async () => (calls++, json(503, {})) });
  await assert.rejects(f('https://example.test/v1/x', { method: 'POST', body: '{}' }), CrosslyError);
  assert.equal(calls, 1);
});

await test('paginate walks pages until total', async () => {
  const all = [1, 2, 3, 4, 5];
  let pages = 0;
  const got = [];
  for await (const n of paginate(async (page, limit) => {
    pages++;
    return { data: all.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: all.length } };
  }, { limit: 2 })) got.push(n);
  assert.deepEqual(got, all);
  assert.equal(pages, 3);
});

if (basename(dir) === 'seller') {
  await test('generated ListingsApi through createConfiguration + paginate', async () => {
    const urls = [];
    const config = createConfiguration({
      token: 'crossly_pat_test',
      fetch: async (url, init) => {
        urls.push(url);
        assert.equal(new Headers(init.headers).get('authorization'), 'Bearer crossly_pat_test');
        const page = Number(new URL(url).searchParams.get('page'));
        return json(200, { data: [{ id: `l${page}`, title: 't', status: 'active' }], pagination: { page, limit: 1, totalPages: 2 } });
      },
    });
    const api = new sdk.ListingsApi(config);
    const ids = [];
    for await (const l of paginate((page, limit) => api.listListings({ page, limit }), { limit: 1 })) ids.push(l.id);
    assert.deepEqual(ids, ['l1', 'l2']);
    assert.match(urls[0], /^https:\/\/crossly\.net\/api\/v1\/listings\?/);
  });
}

const secret = 'whsec_test';
const body = '{"id":"evt_1","type":"listing.sold","created":"2026-01-01T00:00:00Z","data":{"x":1}}';
const sign = (b, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${b}`).digest('hex')}`;
const delivery = (b, sig) => new Request('https://example.test/hooks', { method: 'POST', body: b, headers: { 'crossly-signature': sig } });

await test('webhookHandler: verified, tampered, replayed, wrong method', async () => {
  let got;
  const h = webhookHandler(secret, (event) => {
    got = event;
    return new Response(null, { status: 204 });
  });
  assert.equal((await h(delivery(body, sign(body)))).status, 204);
  assert.equal(got.type, 'listing.sold');
  const tampered = await h(delivery(`${body} `, sign(body)));
  assert.equal(tampered.status, 400);
  assert.equal((await tampered.json()).error.code, 'bad_signature');
  const old = await h(delivery(body, sign(body, Math.floor(Date.now() / 1000) - 3600)));
  assert.equal((await old.json()).error.code, 'timestamp_out_of_tolerance');
  assert.equal((await h(new Request('https://example.test/hooks'))).status, 405);
  await verifyWebhook(body, sign(body), secret);
});

await test('honoWebhook: sets crosslyEvent and calls next; refuses without next', async () => {
  const mw = honoWebhook(secret);
  const vars = new Map();
  let nextCalled = false;
  const ctx = (req) => ({ req: { raw: req }, set: (k, v) => vars.set(k, v) });
  const okReq = delivery(body, sign(body));
  assert.equal(await mw(ctx(okReq), async () => void (nextCalled = true)), undefined);
  assert.ok(nextCalled);
  assert.equal(vars.get('crosslyEvent').id, 'evt_1');
  assert.equal(await okReq.text(), body, 'the handler can still read the body');
  nextCalled = false;
  const res = await mw(ctx(delivery(body, 't=1,v1=00')), async () => void (nextCalled = true));
  assert.equal(res.status, 400);
  assert.equal(nextCalled, false);
});

console.log(`smoke ${basename(dir)}: ${passed} passed`);
