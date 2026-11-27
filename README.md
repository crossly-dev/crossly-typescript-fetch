# Crossly TypeScript (Fetch API) SDK

[![ci](https://github.com/crossly-dev/crossly-typescript-fetch/actions/workflows/ci.yml/badge.svg)](https://github.com/crossly-dev/crossly-typescript-fetch/actions/workflows/ci.yml) [![release](https://github.com/crossly-dev/crossly-typescript-fetch/actions/workflows/release.yml/badge.svg)](https://github.com/crossly-dev/crossly-typescript-fetch/actions/workflows/release.yml) [![npm](https://img.shields.io/npm/v/@crossly/fetch)](https://www.npmjs.com/package/@crossly/fetch) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Official TypeScript (Fetch API) clients for the [Crossly](https://crossly.net) API: list once and sell across every marketplace, read
orders, manage inventory, and receive signed webhooks. Generated from the public OpenAPI specs and released
automatically when they change, with signed build provenance.

## Install

| client | for | install |
|---|---|---|
| seller | your store: listings, crossposting, orders, analytics | `npm install @crossly/fetch` |
| buyer | shopping: cart, orders, wishlists, offers, cashback | `npm install @crossly/buyer-fetch` |

## Two clients, two credentials

| client | credential |
|---|---|
| seller | a Personal Access Token (`crossly_pat_…`, Settings → Developer) or a seller OAuth token |
| buyer | a buyer OAuth token (`crossly_oat_…`) with `buyer:*` scopes |

They are not interchangeable: a seller token is refused by the buyer API and the reverse, even for the same
Crossly account. A 401 from a call that looks right usually means the other client's token.

## First call

```ts
import { ListingsApi, createConfiguration } from '@crossly/fetch'; // Deno: 'npm:@crossly/fetch'

// Retries 429/5xx with backoff (honouring Retry-After), adds an Idempotency-Key to POST/PATCH,
// 30 s per-attempt timeout, User-Agent crossly-typescript-fetch/<version>.
const config = createConfiguration({ token: env.CROSSLY_TOKEN }); // crossly_pat_…
const page = await new ListingsApi(config).listListings({ page: 1, limit: 25 });
for (const item of page.data) {
  console.log(item.id, item.title, item.status);
}
```

List calls return `{ data, pagination }` and page with `page` and `limit`. Money fields named `…_cents` are
integer cents. A failed call rejects with a `CrosslyError` carrying `status`, `code`, `message`, `details`, `retryAfterSeconds` and the `correlationId` support can trace.

## Webhooks

Crossly signs every webhook with `Crossly-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`. The verifier
ships in the seller and buyer packages and checks the signature in constant time, rejects a timestamp more than
five minutes old, and returns the parsed event:

```ts
import { webhookHandler } from '@crossly/fetch';

// Cloudflare Workers / Deno.serve / Bun.serve / a Next.js route handler: (Request) => Promise<Response>
export default {
  fetch: (request: Request, env: Env) =>
    webhookHandler(env.CROSSLY_WEBHOOK_SECRET, async (event) => {
      console.log(event.type, event.id);
      return new Response(null, { status: 204 });
    })(request),
};

// or by hand, over the exact body: await verifyWebhook(await request.text(), request.headers.get('crossly-signature'), secret)
```

Verify the raw bytes, not a re-serialised body. `webhooks/` holds the same verifier on its own, with the shared
test vectors every language's port is checked against on each build.

## Runtimes

No Node APIs and no runtime dependencies: only `fetch`, `Request`/`Response` and Web Crypto. It runs on
Cloudflare Workers, Deno (`npm:@crossly/fetch`), Bun, Node 18+ and browsers. For Node-first code with
resource-style methods there is also [`@crossly/sdk`](https://github.com/crossly-dev/crossly-sdk).

## Client helpers

| helper | what it does |
|---|---|
| `createConfiguration({ token, … })` | a `Configuration` for every generated API class; options `timeoutMs` (30000), `maxRetries` (3), `maxRetryAfterSeconds` (60), `baseBackoffMs`, `idempotencyKeys` (true), `basePath`, `fetch`, `headers` |
| `crosslyFetch(options)` | the fetch it installs: retries 429 always, and 5xx / network errors for reads and keyed writes, with full-jitter backoff or exactly `Retry-After`; one `Idempotency-Key` per POST/PATCH across its attempts (the API replays the first response for 24 h); throws `CrosslyError` on a non-2xx |
| `paginate((page, limit) => …)` | an async iterator over every row of a list endpoint |
| `CrosslyError` | `status`, `code`, `message`, `details`, `correlationId`, `retryAfterSeconds`, `body` |

```ts
import { ListingsApi, createConfiguration, paginate, CrosslyError } from '@crossly/fetch';

const listings = new ListingsApi(createConfiguration({ token: env.CROSSLY_TOKEN }));
try {
  for await (const item of paginate((page, limit) => listings.listListings({ page, limit }))) {
    console.log(item.id);
  }
} catch (err) {
  if (err instanceof CrosslyError && err.code === 'rate_limited') console.log('retry in', err.retryAfterSeconds);
  else throw err;
}
```

The buyer client (`@crossly/buyer-fetch`) has the same helpers, for a buyer OAuth token.

## Webhook middleware

`webhookHandler(secret, handle)` is a complete `(Request) => Promise<Response>` endpoint; `verifyRequest(request,
secret)` is the building block; `honoWebhook(secret)` is Hono middleware that answers an unverified delivery with
a 400 `{"error":{"code":"<reason>"}}` and puts the event on the context:

```ts
import { Hono } from 'hono';
import { honoWebhook, type WebhookEvent } from '@crossly/fetch';

const app = new Hono<{ Bindings: Env; Variables: { crosslyEvent: WebhookEvent } }>();
app.post('/webhooks/crossly', (c, next) => honoWebhook(c.env.CROSSLY_WEBHOOK_SECRET)(c, next), (c) => {
  const event = c.get('crosslyEvent');
  console.log(event.type, event.id);
  return c.body(null, 204);
});
```

Deliveries over 1 MiB are refused with a 413. [examples/](examples/) has a Worker that lists listings and
receives webhooks.

## Where things are

| client | API classes | models | API reference pages |
|---|---|---|---|
| seller | `seller/src/apis/` | `seller/src/models/<area>/` | — |
| buyer | `buyer/src/apis/` | `buyer/src/models/<area>/` | — |

One class per API group (`OrdersApi`, `ListingsApi`, …), one model per type, the
models grouped one folder per product area (`vault`, `world`, `order`, …). A type
several endpoints share is ONE model, named after where it first appears
(`GetOrderResponse`, `ListOrdersItem`) or, for small shared shapes such as `{ ok }`,
after its fields (`OkResponse`). Each client README lists every method.

## Versions and changelog

Semantic versioning. While the version is 0.x, a release that removes an operation or a model bumps the minor
version; anything else bumps the patch. Every [CHANGELOG](CHANGELOG.md) entry lists the operations and models
that were added, changed or removed in the specs it was generated from.

## Verifying a release

Every release artifact is built on GitHub-hosted runners by [release.yml](.github/workflows/release.yml) and
carries a signed SLSA provenance attestation:

```sh
gh attestation verify <downloaded-file> --repo crossly-dev/crossly-typescript-fetch
```

## Contributing

`seller/`, `buyer/` and `webhooks/` are generated, so a pull request that edits them would be overwritten by the
next release. Open an issue instead: the fix goes into the API spec or the generator, and every language picks it
up. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to regenerate locally.

## More

- API reference and guides: https://crossly.net/docs
- Other languages: https://github.com/crossly-dev
- TypeScript (Node and browsers): [`@crossly/sdk`](https://github.com/crossly-dev/crossly-sdk); command line: [`@crossly/cli`](https://github.com/crossly-dev/crossly-cli); AI agents: [`@crossly/mcp`](https://github.com/crossly-dev/crossly-mcp)

## License

[MIT](LICENSE)
