// Every-minute automation. Called by pg_cron (see migrations/…_schedule.sql) with the shared cron secret.
import { db, json, secretMatches } from '../_shared/db.ts';
import { runTick } from '../_shared/tick.ts';
import { vehicleControl } from '../_shared/vehicles.ts';

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get('x-cron-secret'), Deno.env.get('CRON_SECRET'))) return json({ error: 'unauthorized' }, 401);
  const sql = db();
  try {
    return json(await runTick(sql, vehicleControl(sql)));
  } catch (e) {
    console.error('tick failed', e);
    return json({ error: String(e) }, 500);
  }
});
