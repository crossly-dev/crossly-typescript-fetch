/**
 * Crossly webhooks on Hono (Workers, Deno, Bun, Node):
 *
 *   npm install @crossly/fetch hono
 */
import { Hono } from 'hono';
import { honoWebhook, type WebhookEvent } from '@crossly/fetch';

type Env = { Bindings: { CROSSLY_WEBHOOK_SECRET: string }; Variables: { crosslyEvent: WebhookEvent } };

const app = new Hono<Env>();

app.post(
  '/webhooks/crossly',
  (c, next) => honoWebhook(c.env.CROSSLY_WEBHOOK_SECRET)(c, next),
  (c) => {
    const event = c.get('crosslyEvent');
    console.log(event.type, event.id);
    return c.body(null, 204);
  },
);

export default app;
