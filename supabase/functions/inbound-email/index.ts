// Receives Turo emails from the Gmail forwarder (scripts/gmail-forwarder.gs).
// POST { emails: [{ messageId, receivedAt, subject, body }] } with header x-intake-secret.
import { db, json, secretMatches } from '../_shared/db.ts';
import { applyEmail, type IncomingEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!secretMatches(req.headers.get('x-intake-secret'), Deno.env.get('INTAKE_SECRET'))) return json({ error: 'unauthorized' }, 401);
  const payload = (await req.json().catch(() => null)) as { emails?: IncomingEmail[] } | null;
  if (!payload?.emails?.length) return json({ error: 'no emails' }, 400);
  const sql = db();
  const results = [];
  for (const e of payload.emails.slice(0, 100)) {
    if (!e.messageId || !e.subject || typeof e.body !== 'string') {
      results.push({ messageId: e.messageId, status: 'error', note: 'missing fields' });
      continue;
    }
    results.push({ messageId: e.messageId, ...(await applyEmail(sql, e)) });
  }
  return json({ results });
});
