// Type-checks honoWebhook against the real Hono types (check-typescript-fetch.sh installs hono for this only).
import { Hono } from 'hono';
import { honoWebhook } from '../src/webhooks-middleware';
import type { WebhookEvent } from '../src/webhooks';

const app = new Hono<{ Variables: { crosslyEvent: WebhookEvent } }>();
app.post('/webhooks/crossly', honoWebhook('whsec_test'), (c) => {
  const event: WebhookEvent = c.get('crosslyEvent');
  return c.json({ received: event.id });
});
const plain = new Hono();
plain.use('/hooks/*', honoWebhook('whsec_test'));
export default app;
