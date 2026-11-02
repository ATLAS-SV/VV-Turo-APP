// Guest check-in link backend (public, protected by the per-booking secret token).
//   GET  /checkin?t=TOKEN                       → status for the guest page
//   POST /checkin { t, lat, lng, accuracy }     → unlock if the guest is in the lot during the pickup window
import { db, json } from '../_shared/db.ts';
import { checkInAttempt, checkInStatus } from '../_shared/checkin.ts';
import { vehicleControl } from '../_shared/vehicles.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const sql = db();
  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('t') ?? '';
    const status = /^[a-f0-9]{32}$/.test(token) ? await checkInStatus(sql, token) : null;
    return status ? json(status, 200, CORS) : json({ error: 'Link not found' }, 404, CORS);
  }
  if (req.method === 'POST') {
    const b = (await req.json().catch(() => null)) as { t?: string; lat?: number; lng?: number; accuracy?: number } | null;
    if (!b?.t || !/^[a-f0-9]{32}$/.test(b.t) || typeof b.lat !== 'number' || typeof b.lng !== 'number' || typeof b.accuracy !== 'number') {
      return json({ error: 'Bad request' }, 400, CORS);
    }
    const result = await checkInAttempt(sql, vehicleControl(sql), { token: b.t, lat: b.lat, lng: b.lng, accuracy: b.accuracy });
    return result ? json(result, 200, CORS) : json({ error: 'Link not found' }, 404, CORS);
  }
  return json({ error: 'Method not allowed' }, 405, CORS);
});
