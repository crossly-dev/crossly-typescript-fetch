/**
 * Verifying a Crossly webhook.
 *
 * Copied verbatim from @crossly/sdk by integrations/webhooks — it is the SAME
 * implementation, kept here so the generated typescript-fetch client is
 * self-contained. Edit the SDK copy; this one is regenerated.
 *
 * ── WHY THIS IS IN THE SDK AT ALL ────────────────────────────────────
 * Because the alternative is every integrator writing it themselves, and the
 * three ways to get it wrong are all silent:
 *
 *   1. Verifying against a re-serialised body. `JSON.parse` then
 *      `JSON.stringify` does not round-trip byte for byte — key order and
 *      number formatting both drift — so the signature fails on payloads that
 *      are perfectly genuine, and the usual fix somebody reaches for is to
 *      stop verifying.
 *   2. Comparing with `===`. A string compare returns early on the first
 *      differing byte, and the timing difference is enough to forge a
 *      signature given enough attempts.
 *   3. Ignoring the timestamp. Without it a captured request replays forever,
 *      and "the signature was valid" is true every time.
 *
 * ── WEB CRYPTO, NOT node:crypto ──────────────────────────────────────
 * This package's headline property is zero runtime dependencies and running
 * anywhere — browsers, Cloudflare Workers, Deno, Bun, Node. `node:crypto`
 * would quietly make it Node-only, and Workers is exactly where small webhook
 * receivers get deployed.
 *
 * The cost is that verification is async, because `crypto.subtle` is. That is
 * the whole reason this returns a Promise.
 *
 * ── THE SCHEME ───────────────────────────────────────────────────────
 *   Crossly-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
 *
 * signed over `${t}.${rawBody}` with the endpoint's secret. The timestamp is
 * inside the signed message on purpose — it cannot be edited to defeat the
 * freshness check without invalidating the signature.
 *
 * Also sent: `Crossly-Event` (the event name) and `Crossly-Delivery-Id`
 * (stable across retries — use it to deduplicate, because at-least-once
 * delivery means you WILL see the same event twice).
 */

export class WebhookVerificationError extends Error {
  readonly reason:
    | 'malformed_header'
    | 'bad_signature'
    | 'timestamp_out_of_tolerance'
    | 'missing_secret'
    | 'no_crypto';

  constructor(reason: WebhookVerificationError['reason'], message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
    this.reason = reason;
  }
}

export interface WebhookEvent<T = unknown> {
  id: string;
  /** e.g. `listing.sold`. */
  type: string;
  /** ISO-8601, from the sender. */
  created: string;
  data: T;
}

export interface VerifyOptions {
  /**
   * How far the timestamp may be from now, in seconds. Default 300.
   *
   * Five minutes rather than five seconds because a retried delivery can sit
   * in a queue, and clocks on other people's servers are not ours. Tighter
   * than this rejects genuine deliveries; much looser and a captured request
   * stays replayable for a useful window.
   */
  toleranceSeconds?: number;
  /** Override "now", for tests. Seconds since epoch. */
  nowSeconds?: number;
}

function parseSignatureHeader(header: string): { t: number; v1: string } | null {
  // `t=1700000000,v1=abc…`. Parsed field-wise rather than by one regex so a
  // future `v2=` alongside `v1=` does not break existing verifiers — which is
  // the entire reason the scheme carries a version.
  let t: number | null = null;
  let v1: string | null = null;

  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      const n = Number(value);
      if (Number.isFinite(n)) t = n;
    } else if (key === 'v1') {
      v1 = value;
    }
  }

  if (t === null || !v1) return null;
  return { t, v1 };
}

/**
 * Constant-time string compare.
 *
 * Hand-rolled because `crypto.subtle` has no equivalent and `timingSafeEqual`
 * is Node-only. Accumulates a XOR difference over the WHOLE input rather than
 * returning early, so the time taken does not depend on where the first
 * mismatch is.
 *
 * Unequal lengths still walk the longer string, because returning early on a
 * length check leaks the length — which for a fixed-length hex digest is not
 * much, but the habit matters more than this instance.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function getSubtle(): SubtleCrypto {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) {
    throw new WebhookVerificationError(
      'no_crypto',
      'Web Crypto is unavailable. Node 18+, Deno, Bun, Cloudflare Workers and browsers all ' +
        'provide globalThis.crypto.subtle; on older Node, run with --experimental-global-webcrypto.',
    );
  }
  return subtle;
}

/**
 * Verify a webhook and return the parsed event.
 *
 * @param rawBody  The EXACT bytes received. Not a parsed object, and not
 *                 `JSON.stringify(req.body)` — see the header. In Express use
 *                 `express.raw({ type: 'application/json' })`; in Fastify set
 *                 `config: { rawBody: true }`; in Next.js route handlers use
 *                 `await request.text()`.
 * @param signatureHeader  The `Crossly-Signature` header, verbatim.
 * @param secret  The endpoint's signing secret, from Settings → Webhooks.
 *
 * @throws {WebhookVerificationError} on anything that does not verify. It
 *         throws rather than returning false so a caller who forgets to check
 *         a boolean does not silently accept forged events.
 */
export async function verifyWebhook<T = unknown>(
  rawBody: string | Uint8Array,
  signatureHeader: string | undefined | null,
  secret: string,
  options: VerifyOptions = {},
): Promise<WebhookEvent<T>> {
  if (!secret) {
    throw new WebhookVerificationError('missing_secret', 'A webhook signing secret is required.');
  }
  if (!signatureHeader) {
    throw new WebhookVerificationError(
      'malformed_header',
      'No Crossly-Signature header on the request.',
    );
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    throw new WebhookVerificationError(
      'malformed_header',
      `Could not parse Crossly-Signature: expected "t=<unix>,v1=<hex>", got ` +
        `"${signatureHeader.slice(0, 60)}".`,
    );
  }

  const body = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);

  const subtle = getSubtle();
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${parsed.t}.${body}`),
  );
  const expected = toHex(signature);

  if (!timingSafeEqualString(expected, parsed.v1)) {
    throw new WebhookVerificationError(
      'bad_signature',
      'Signature did not match. If genuine payloads are failing, you are almost certainly ' +
        'verifying a re-serialised body — pass the raw bytes, not JSON.stringify(req.body).',
    );
  }

  // Freshness is checked AFTER the signature, so an attacker cannot learn
  // anything about timestamps without already holding a valid signature.
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.t) > tolerance) {
    throw new WebhookVerificationError(
      'timestamp_out_of_tolerance',
      `Timestamp is ${Math.abs(now - parsed.t)}s away from now (tolerance ${tolerance}s). ` +
        'This is a replay guard — if it fires on live traffic, check your server clock.',
    );
  }

  return JSON.parse(body) as WebhookEvent<T>;
}
