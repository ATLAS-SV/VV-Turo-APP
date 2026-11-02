// Applies one Turo email to the database. Each email (by message ID) is applied at most once.
import { carName, logActivity, toCar, type Sql } from './db.ts';
import { matchCarId, parseTuroEmail, type TuroEmail } from './logic/turoEmail.ts';

export interface IncomingEmail {
  messageId: string;
  receivedAt: string; // ISO
  subject: string;
  body: string; // plain text
}

export async function applyEmail(sql: Sql, email: IncomingEmail): Promise<{ status: 'applied' | 'duplicate' | 'ignored' | 'error'; kind: string; note?: string }> {
  const seen = await sql`select 1 from emails where message_id = ${email.messageId}`;
  if (seen.length) return { status: 'duplicate', kind: 'duplicate' };

  const parsed = parseTuroEmail(email.subject, email.body);
  let note: string | undefined;
  let error: string | null = null;
  try {
    note = await apply(sql, parsed, email);
  } catch (e) {
    error = String(e);
  }
  await sql`
    insert into emails (message_id, received_at, subject, kind, parsed, error)
    values (${email.messageId}, ${email.receivedAt}, ${email.subject}, ${parsed.kind}, ${sql.json(parsed as never)}, ${error})
    on conflict do nothing`;
  if (error) return { status: 'error', kind: parsed.kind, note: error };
  return { status: parsed.kind === 'ignored' ? 'ignored' : 'applied', kind: parsed.kind, note };
}

async function apply(sql: Sql, e: TuroEmail, email: IncomingEmail): Promise<string | undefined> {
  const cars = (await sql`select * from cars`).map(toCar);
  const sys = { kind: 'system' } as const;

  switch (e.kind) {
    case 'booked':
    case 'upcoming':
    case 'changed': {
      const carId = matchCarId(cars, e.carLabel);
      await sql`
        insert into bookings (id, car_id, guest_first_name, guest_phone, trip_start, trip_end, earnings, turo_conversation_url)
        values (${e.reservationId}, ${carId}, ${e.guestFirstName}, ${e.guestPhone}, ${e.tripStart}, ${e.tripEnd},
                ${e.earnings ?? 0}, ${e.conversationUrl})
        on conflict (id) do update set
          car_id = coalesce(excluded.car_id, bookings.car_id),
          guest_first_name = excluded.guest_first_name,
          guest_phone = coalesce(excluded.guest_phone, bookings.guest_phone),
          trip_start = excluded.trip_start,
          trip_end = excluded.trip_end,
          earnings = case when ${e.earnings !== null} then excluded.earnings else bookings.earnings end,
          turo_conversation_url = excluded.turo_conversation_url,
          updated_at = now()`;
      if (e.kind === 'booked') {
        await logActivity(sql, 'booking_received', sys, { carId, detail: `New booking from Turo: ${e.guestFirstName}, ${carName(cars.find((c) => c.id === carId))}` });
      }
      return carId ? undefined : `No car matched "${e.carLabel}"`;
    }

    case 'canceled': {
      const r = await sql`update bookings set canceled = true, cancel_reason = ${e.reason}, updated_at = now() where id = ${e.reservationId} returning car_id`;
      if (!r.length) return 'Canceled booking was not in the app (booked before email reading started)';
      await logActivity(sql, 'booking_canceled', sys, { carId: r[0].car_id, detail: `${e.guestFirstName} canceled their trip${e.reason ? ` (${e.reason})` : ''}`, notify: true });
      return;
    }

    case 'payout':
      await sql`insert into payouts (id, sent_at, amount) values (${email.messageId}, ${email.receivedAt}, ${e.amount}) on conflict do nothing`;
      return;

    case 'reimbursement_invoice': {
      const b = e.reservationId ? await sql`select car_id from bookings where id = ${e.reservationId}` : [];
      await sql`
        insert into earning_extras (id, type, amount, date, car_id, reservation_id, description, status)
        values (${email.messageId}, 'reimbursement', ${e.total}, ${email.receivedAt}, ${b[0]?.car_id ?? null}, ${e.reservationId},
                ${`${e.items.join(', ') || 'Reimbursement'} (${e.guestFirstName})`}, 'invoiced')
        on conflict do nothing`;
      return;
    }

    case 'reimbursement_paid': {
      await sql`
        update earning_extras set status = 'paid'
        where id = (select id from earning_extras where type = 'reimbursement' and status = 'invoiced'
                    and description like ${`%(${e.guestFirstName})`} order by date desc limit 1)`;
      return;
    }

    case 'reimbursement_no_response':
      await sql`
        insert into tasks_extra (id, kind, title, detail, due_at)
        values (${`reimb-${email.messageId}`}, 'claim', ${`Follow up: ${e.guestFirstName} hasn't paid the reimbursement invoice`},
                'Check the invoice in Turo and decide whether to escalate.', ${email.receivedAt}::timestamptz + interval '1 day')
        on conflict do nothing`;
      return;

    case 'claim_deadline': {
      const carId = matchCarId(cars, e.carLabel);
      const due = e.escalateBy ?? new Date(Date.parse(email.receivedAt) + 7 * 86400_000).toISOString();
      await sql`
        insert into tasks_extra (id, kind, title, detail, car_id, due_at)
        values (${`claim-${e.incidentNumber ?? email.messageId}`}, 'claim',
                ${`Claim: settle with ${e.guestFirstName} or escalate to Turo`},
                ${`Incident #${e.incidentNumber ?? '?'}${e.plate ? `, plate ${e.plate}` : ''}. Turo deadline to escalate.`},
                ${carId}, ${due})
        on conflict (id) do update set due_at = excluded.due_at`;
      return;
    }

    case 'license_reminder': {
      const carId = matchCarId(cars, e.carLabel);
      const b = await sql`
        select id from bookings where guest_first_name = ${e.guestFirstName} and car_id = ${carId} and not canceled
        and trip_start > now() - interval '1 day' order by trip_start limit 1`;
      if (b.length) await sql`delete from task_done where task_id = ${`${b[0].id}:confirm_license`}`; // reopen if ticked by mistake
      await logActivity(sql, 'task_reminder', sys, { carId, detail: `Turo: ${e.guestFirstName}'s license still needs confirming`, notify: true });
      return;
    }

    case 'guest_message': {
      const carId = matchCarId(cars, e.carLabel);
      await logActivity(sql, 'guest_message', { kind: 'guest', bookingId: e.reservationId ?? '', name: e.guestFirstName }, {
        carId,
        detail: 'Sent a message in Turo',
      });
      return;
    }

    case 'ignored':
      return e.reason;
  }
}
