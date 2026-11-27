/**
 * A Cloudflare Worker (also runs on Deno.serve / Bun.serve: it is just `fetch(Request) => Response`):
 *
 *   GET  /listings          the first 50 listings in your store
 *   POST /webhooks/crossly  verified Crossly webhooks
 *
 *   npm install @crossly/fetch
 *   wrangler secret put CROSSLY_TOKEN            # crossly_pat_…
 *   wrangler secret put CROSSLY_WEBHOOK_SECRET   # Settings → Webhooks
 */
import { CrosslyError, ListingsApi, createConfiguration, paginate, webhookHandler } from '@crossly/fetch';

interface Env {
  CROSSLY_TOKEN: string;
  CROSSLY_WEBHOOK_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/webhooks/crossly') {
      return webhookHandler(env.CROSSLY_WEBHOOK_SECRET, async (event) => {
        console.log(event.type, event.id);
        // Answer fast; Crossly retries anything that is not a 2xx.
        return new Response(null, { status: 204 });
      })(request);
    }

    if (url.pathname === '/listings') {
      const listings = new ListingsApi(createConfiguration({ token: env.CROSSLY_TOKEN }));
      const rows: Array<{ id: string; title: unknown; status: unknown }> = [];
      try {
        for await (const item of paginate((page, limit) => listings.listListings({ page, limit }), { limit: 25 })) {
          rows.push({ id: item.id, title: item.title, status: item.status });
          if (rows.length === 50) break;
        }
      } catch (err) {
        if (err instanceof CrosslyError) {
          return Response.json({ code: err.code, correlationId: err.correlationId }, { status: err.status || 502 });
        }
        throw err;
      }
      return Response.json(rows);
    }

    return new Response('not found', { status: 404 });
  },
};
