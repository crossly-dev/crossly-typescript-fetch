/**
 * Client ergonomics over the generated APIs: retries with backoff that honour `Retry-After`, an
 * `Idempotency-Key` on every POST/PATCH, a per-attempt timeout, a `crossly-typescript-fetch/<version>`
 * User-Agent, a typed `CrosslyError`, and `paginate` over any list endpoint. Fetch API only, so it runs on
 * Cloudflare Workers, Deno, Bun, Node 18+ and browsers.
 *
 * Hand-written, vendored by codegen: edit it in the Crossly monorepo (tools/sdk-repo/extras/typescript-fetch/).
 */
import { Configuration, ConfigurationParameters, FetchAPI } from './runtime';
import { SDK_VERSION } from './version';

/** Sent as User-Agent where the runtime allows it (browsers drop it silently). */
export const USER_AGENT = `crossly-typescript-fetch/${SDK_VERSION}`;

export interface RetryOptions {
  /** Retries after the first attempt. Default 3; 0 disables retrying. */
  maxRetries?: number;
  /** First backoff ceiling in ms, doubled per retry (full jitter) up to `maxBackoffMs`. Default 500. */
  baseBackoffMs?: number;
  /** Default 8000. */
  maxBackoffMs?: number;
  /** A `Retry-After` longer than this (seconds) is returned to the caller instead of waited out. Default 60. */
  maxRetryAfterSeconds?: number;
  /**
   * Add an `Idempotency-Key` to POST and PATCH requests without one. The API replays the first response to a
   * repeated key for 24 hours, so a retried write is applied once. Default true.
   */
  idempotencyKeys?: boolean;
}

export interface CrosslyClientOptions extends RetryOptions {
  /** A Personal Access Token (`crossly_pat_…`) or an OAuth token (`crossly_oat_…`). */
  token: string;
  /** Default https://crossly.net/api. */
  basePath?: string;
  /** Per-attempt timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** The fetch to call. Default globalThis.fetch. */
  fetch?: FetchAPI;
  /** Sent on every request. */
  headers?: Record<string, string>;
}

/**
 * A `Configuration` for the generated API classes:
 *
 *     const config = createConfiguration({ token: env.CROSSLY_TOKEN });
 *     const page = await new ListingsApi(config).listListings({ page: 1, limit: 25 });
 *
 * A failed call rejects with a `CrosslyError`.
 */
export function createConfiguration(options: CrosslyClientOptions): Configuration {
  const params: ConfigurationParameters = {
    accessToken: options.token,
    fetchApi: crosslyFetch(options),
    headers: options.headers,
  };
  if (options.basePath) params.basePath = options.basePath.replace(/\/+$/, '');
  return new Configuration(params);
}

/** `{ error: { code, message, details }, correlationId }`, as a thrown error. */
export class CrosslyError extends Error {
  /** HTTP status; 0 when no response arrived (network, timeout). */
  readonly status: number;
  /** Stable machine key: `not_found`, `rate_limited`, `idempotency_key_reused`, … */
  readonly code: string;
  readonly details?: unknown;
  /** What Crossly support traces. */
  readonly correlationId?: string;
  /** Seconds from `Retry-After`, when the API sent one. */
  readonly retryAfterSeconds?: number;
  /** The parsed body (or text) of the response. */
  readonly body?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    extra: { details?: unknown; correlationId?: string; retryAfterSeconds?: number; body?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'CrosslyError';
    this.status = status;
    this.code = code;
    if (extra.details !== undefined) this.details = extra.details;
    if (extra.correlationId) this.correlationId = extra.correlationId;
    if (extra.retryAfterSeconds !== undefined) this.retryAfterSeconds = extra.retryAfterSeconds;
    if (extra.body !== undefined) this.body = extra.body;
    if (extra.cause !== undefined) (this as { cause?: unknown }).cause = extra.cause;
  }

  /** Read a non-2xx Response into a CrosslyError (consumes its body). */
  static async fromResponse(res: Response): Promise<CrosslyError> {
    const text = await res.text().catch(() => '');
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON (a proxy's HTML error page): keep the text
    }
    const env = (typeof body === 'object' && body !== null ? body : {}) as {
      error?: { code?: unknown; message?: unknown; details?: unknown } | string;
      correlationId?: unknown;
    };
    const err = typeof env.error === 'object' && env.error !== null ? env.error : {};
    const code = typeof err.code === 'string' ? err.code : `http_${res.status}`;
    const message =
      typeof err.message === 'string' ? err.message : typeof env.error === 'string' ? env.error : res.statusText || code;
    const correlationId =
      typeof env.correlationId === 'string' ? env.correlationId : res.headers.get('x-correlation-id') ?? undefined;
    return new CrosslyError(res.status, code, message, {
      details: err.details,
      correlationId,
      retryAfterSeconds: retryAfterSeconds(res.headers.get('retry-after')),
      body,
    });
  }
}

/** `Retry-After` as seconds: delta-seconds or an HTTP date (RFC 9110). */
export function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, (at - Date.now()) / 1000);
}

/** A random key for the `Idempotency-Key` header. */
export function newIdempotencyKey(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const RETRYABLE = (status: number) => status === 429 || (status >= 500 && status !== 501);
const sleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error('aborted'));
    });
  });

/**
 * The fetch `createConfiguration` installs, usable on its own. Returns the Response on 2xx; otherwise throws a
 * `CrosslyError` (after any retries). Retried: 429 always (the API refused before doing anything); 5xx and
 * network errors for reads, and for POST/PATCH only when they carry an `Idempotency-Key`.
 */
export function crosslyFetch(options: Partial<CrosslyClientOptions> = {}): FetchAPI {
  const maxRetries = options.maxRetries ?? 3;
  const base = options.baseBackoffMs ?? 500;
  const cap = options.maxBackoffMs ?? 8000;
  const maxRetryAfter = options.maxRetryAfterSeconds ?? 60;
  const timeoutMs = options.timeoutMs ?? 30000;
  const autoKeys = options.idempotencyKeys ?? true;

  const doFetch = async (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
    const fetchImpl: FetchAPI = options.fetch ?? ((i, n) => fetch(i, n));
    const method = (init.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init.headers);
    if (options.token && !headers.has('authorization')) headers.set('Authorization', `Bearer ${options.token}`);
    try {
      headers.set('User-Agent', USER_AGENT);
    } catch {
      // a runtime that forbids setting User-Agent
    }
    const write = method === 'POST' || method === 'PATCH';
    if (write && autoKeys && !headers.has('idempotency-key')) headers.set('Idempotency-Key', newIdempotencyKey());
    const keyed = headers.has('idempotency-key');
    const replayable = init.body == null || typeof init.body === 'string' || init.body instanceof URLSearchParams ||
      (typeof Blob !== 'undefined' && init.body instanceof Blob) ||
      (typeof FormData !== 'undefined' && init.body instanceof FormData) || init.body instanceof ArrayBuffer ||
      ArrayBuffer.isView(init.body);
    const userSignal = init.signal;

    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < maxRetries && replayable && !userSignal?.aborted;
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(new CrosslyError(0, 'timeout', `no response within ${timeoutMs} ms`)), timeoutMs);
      const onAbort = () => timeout.abort(userSignal?.reason);
      userSignal?.addEventListener('abort', onAbort);
      let res: Response;
      try {
        res = await fetchImpl(input, { ...init, method, headers, signal: timeout.signal });
      } catch (cause) {
        clearTimeout(timer);
        userSignal?.removeEventListener('abort', onAbort);
        if (userSignal?.aborted) throw cause;
        if (canRetry && (!write || keyed)) {
          await sleep(backoff(attempt, base, cap), userSignal);
          continue;
        }
        if (cause instanceof CrosslyError) throw cause;
        const timedOut = timeout.signal.aborted;
        throw new CrosslyError(0, timedOut ? 'timeout' : 'network_error', String((cause as Error)?.message ?? cause), { cause });
      }
      clearTimeout(timer);
      userSignal?.removeEventListener('abort', onAbort);
      if (res.ok) return res;
      if (canRetry && RETRYABLE(res.status) && (res.status === 429 || !write || keyed)) {
        const after = retryAfterSeconds(res.headers.get('retry-after'));
        if (after === undefined || after <= maxRetryAfter) {
          await res.body?.cancel().catch(() => undefined);
          await sleep(after !== undefined ? after * 1000 : backoff(attempt, base, cap), userSignal);
          continue;
        }
      }
      throw await CrosslyError.fromResponse(res);
    }
  };
  return doFetch as FetchAPI;
}

function backoff(attempt: number, base: number, cap: number): number {
  return Math.random() * Math.min(cap, base * 2 ** attempt);
}

/** What `paginate` needs from a list response: `{ data, pagination }`. */
export interface PageLike<T> {
  data: Array<T>;
  pagination?: { page: number; limit: number; total?: number; totalPages?: number };
}

/**
 * Every row of a list endpoint, fetching each page when the loop reaches it:
 *
 *     for await (const listing of paginate((page, limit) => listings.listListings({ page, limit }))) {
 *       console.log(listing.id);
 *     }
 *
 * Stops after the last page (totalPages, total, or a short page); a failed page rejects the loop.
 */
export async function* paginate<T>(
  fetchPage: (page: number, limit: number) => Promise<PageLike<T>>,
  options: { limit?: number; startPage?: number } = {},
): AsyncGenerator<T, void, undefined> {
  const limit = options.limit && options.limit > 0 ? options.limit : 100;
  for (let page = options.startPage ?? 1; ; page++) {
    const res = await fetchPage(page, limit);
    const rows = res.data ?? [];
    for (const row of rows) yield row;
    const p = res.pagination;
    if (!p || rows.length === 0) return;
    if (p.totalPages != null) {
      if (page >= p.totalPages) return;
    } else if (p.total != null) {
      if (page * limit >= p.total) return;
    } else if (rows.length < (p.limit > 0 ? p.limit : limit)) return;
  }
}
