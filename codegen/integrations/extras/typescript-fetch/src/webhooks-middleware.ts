/**
 * Receiving Crossly webhooks on the Fetch API (`Request` → `Response`): Cloudflare Workers, Deno, Bun, Next.js
 * route handlers, and Hono. Verification reads the exact body bytes, so never parse the body before it.
 *
 * Hand-written, vendored by codegen: edit it in the Crossly monorepo (tools/sdk-repo/extras/typescript-fetch/).
 */
import { verifyWebhook, VerifyOptions, WebhookEvent, WebhookVerificationError } from './webhooks';

/** Deliveries larger than this (bytes) are refused with a 413. */
export const MAX_WEBHOOK_BYTES = 1024 * 1024;

function rejection(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Read and verify a delivery. Rejects with a `WebhookVerificationError` (or a 413-coded one for a huge body). */
export async function verifyRequest<T = unknown>(
  request: Request,
  secret: string,
  options?: VerifyOptions,
): Promise<WebhookEvent<T>> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_WEBHOOK_BYTES) throw new WebhookTooLargeError();
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_WEBHOOK_BYTES) throw new WebhookTooLargeError();
  return verifyWebhook<T>(raw, request.headers.get('crossly-signature'), secret, options);
}

export class WebhookTooLargeError extends Error {
  constructor() {
    super(`Webhook body exceeds ${MAX_WEBHOOK_BYTES} bytes.`);
    this.name = 'WebhookTooLargeError';
  }
}

/** The Response a receiver answers a failed verification with: 400 (500 for a missing secret, 413 if huge). */
export function webhookErrorResponse(err: unknown): Response {
  if (err instanceof WebhookTooLargeError) return rejection(413, 'body_too_large', err.message);
  if (err instanceof WebhookVerificationError) {
    return rejection(err.reason === 'missing_secret' || err.reason === 'no_crypto' ? 500 : 400, err.reason, err.message);
  }
  return rejection(400, 'malformed_body', err instanceof Error ? err.message : String(err));
}

/**
 * A complete endpoint: `(request) => Promise<Response>`. `handle` runs only for verified events; an
 * unverified request gets a 400 JSON error, a non-POST a 405.
 *
 *     export default { fetch: webhookHandler(env.CROSSLY_WEBHOOK_SECRET, async (event) => {
 *       console.log(event.type, event.id);
 *       return new Response(null, { status: 204 });
 *     }) };
 */
export function webhookHandler<T = unknown>(
  secret: string,
  handle: (event: WebhookEvent<T>, request: Request) => Response | Promise<Response>,
  options?: VerifyOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') return rejection(405, 'method_not_allowed', 'Webhooks are POSTed.');
    let event: WebhookEvent<T>;
    try {
      event = await verifyRequest<T>(request, secret, options);
    } catch (err) {
      return webhookErrorResponse(err);
    }
    return handle(event, request);
  };
}

/** The slice of Hono's Context the middleware uses (typed structurally: no dependency on hono). */
export interface HonoLikeContext {
  req: { raw: Request };
  set: (key: any, value: any) => void;
}

/** Where `honoWebhook` puts the verified event: `c.get('crosslyEvent')`. */
export const HONO_EVENT_KEY = 'crosslyEvent';

/**
 * Hono middleware. Verifies the delivery and stores the event under `c.get('crosslyEvent')`; an unverified
 * request is answered with a 400 JSON error and never reaches the handler. The body is read from a clone, so
 * the handler can still call `c.req.json()`.
 *
 *     app.post('/webhooks/crossly', honoWebhook(env.CROSSLY_WEBHOOK_SECRET), (c) => {
 *       const event = c.get('crosslyEvent') as WebhookEvent;
 *       return c.body(null, 204);
 *     });
 */
export function honoWebhook(secret: string, options?: VerifyOptions) {
  return async (c: HonoLikeContext, next: () => Promise<void>): Promise<Response | void> => {
    let event: WebhookEvent;
    try {
      event = await verifyRequest(c.req.raw.clone(), secret, options);
    } catch (err) {
      return webhookErrorResponse(err);
    }
    c.set(HONO_EVENT_KEY, event);
    await next();
  };
}
