# VV inc. — Valadon Ventures fleet app

Phone app (iPhone + Android, built with Expo / React Native) for running the Valadon Ventures Turo fleet.
Shows as **VV inc.** on the phone, with the Valadon Ventures logo in the app. It can
lock/unlock every car from one screen, see where every car is, auto-lock in the home lot,
guest check-in links, bookings, and employee hours.

**Status: version 1 runs on pretend data.** Smartcar, Zubie and the Gmail booking reader are not connected yet.

## Install on iPhone (home-screen web app, free)

The app is hosted as a web app; no App Store, no fees, no expiry.

1. Hosting (one time): sign up at vercel.com with GitHub → **Add New → Project** → import `ATLAS-SV/VV-Turo-APP`
   → keep the detected settings (they come from `vercel.json`) → **Deploy**. Every push updates the site.
2. On the iPhone, open the Vercel link in **Safari** → **Share** → **Add to Home Screen** → **Add**.
3. Tap the **VV inc.** icon. It opens full screen like an app.

Build it locally: `npx expo export --platform web` (output in `dist/`).

One-page clickable demo (pretend data, preset PINs: Executive 1357, Employee 2468):
`EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-demo && node scripts/make-demo-page.mjs dist-demo demo.html`

## Server (Supabase) — set up once

The server runs auto-lock and guest relock every minute (even when no phone has the app open),
reads Turo emails, and serves the guest check-in link. Code: `supabase/`.

| Piece | What it does |
| --- | --- |
| `supabase/migrations/` | Database tables (locked down: only the server can read/write), starting data, and the every-minute schedule |
| `supabase/functions/tick` | Every minute: auto-lock, guest countdown relock, trip started, late returns, task reminders |
| `supabase/functions/inbound-email` | Applies Turo emails: bookings, changes, cancellations (→ missed earnings), payouts, reimbursements, claim deadlines, license reminders |
| `supabase/functions/checkin` | Guest check-in link: status + unlock when the guest is in the lot during the pickup window |
| `scripts/gmail-forwarder.gs` | Runs in your Gmail account; sends new Turo emails to the server every 5 minutes |
| `supabase/functions/_shared/logic/` | Same rules as the app, copied by `npm run sync:server` (edit `src/logic`, not the copy) |

Steps (on your computer, one time):

1. Create a free project at supabase.com. Note the **project ref** (in the URL) and the **database password**.
2. Install the Supabase CLI (https://supabase.com/docs/guides/cli), then in this folder:

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

3. Make two long random secrets (e.g. `openssl rand -hex 32`, run twice) and save them:

   ```bash
   supabase secrets set CRON_SECRET=<secret-1> INTAKE_SECRET=<secret-2>
   supabase functions deploy tick
   supabase functions deploy inbound-email
   supabase functions deploy checkin
   ```

4. In the Supabase dashboard → **SQL Editor**, run once (turns on the every-minute schedule):

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<secret-1>', 'cron_secret');
   ```

5. Set up the Gmail forwarder: follow the steps at the top of `scripts/gmail-forwarder.gs`
   (URL `https://<project-ref>.supabase.co/functions/v1/inbound-email`, secret `<secret-2>`).

Server test (needs a throwaway Postgres with the migrations applied; it wipes app tables):
`SUPABASE_DB_URL=postgres://... deno test -A --config supabase/functions/deno.json supabase/tests/server_test.ts`

Still to come: the phone app reading/writing through the server (it still uses on-phone pretend data),
the guest check-in web page, push notifications, then Smartcar and Zubie.

## Try it

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. The app always opens to the PIN pad;
on the very first launch it asks you to create the Executive PIN. Press `w` to open a browser preview instead (the map is simplified in the browser).

```bash
npm test          # rules: auto-lock, guest check-in, PIN lockout, roles, hours, money, tasks, schedule
npm run typecheck
npx expo lint
```

## What's built

| Area | Where |
| --- | --- |
| **Overview** (raised middle tab, opens after the PIN): one condensed screen of boxes: To do (alerts + tasks), Fleet, Money (mini donut), Bookings brief, Map, Hours; tap a box to open its page | `src/app/(tabs)/index.tsx` |
| **Tasks**: every booking auto-gets a checklist (confirm license, check-in photos, dash photo; check-out photos + dash photo after return) plus pending claims; due-soon and overdue reminders in-app and as phone notifications | `src/logic/tasks.ts`, `src/app/tasks.tsx`, `src/services/notifications.ts` |
| PIN pad is the first screen; the PIN decides the person, the role, and which page opens (set per person in Team & PINs); app locks after 5 wrong tries (5 min, then 10, 20…) | `src/app/sign-in.tsx`, `src/logic/pin.ts` |
| Sign-in: the full-screen logo shrinks into the small VV logo in the header as the app opens | `src/ui/LogoTransition.tsx` |
| Motion: swipe left/right on any tab page to move to the next tab (it slides in from that side; off on the Map, which needs dragging); tapping a box or card grows it into the page it opens | `src/ui/motion.tsx` |
| Tab bar (5 per role, Overview in the middle). Executive: Cars & Bookings · Map · Overview · Money · More. Employee: Cars & Trips · Map · Overview · Hours · More. Activity log, Tasks and Hours (Executive) are in More | `src/app/(tabs)/_layout.tsx` |
| All cars on one screen; one-tap lock, unlock always asks for the PIN | `src/ui/CarsList.tsx` |
| Map + trip history (left/back times, distance, stops) | `src/app/(tabs)/map.tsx`, `src/app/car/[id].tsx` |
| Auto-lock: home lot only, parked & unlocked for the set time; notifies + logs | `src/logic/autoLock.ts`, `src/logic/automation.ts` |
| Guest check-in: pickup window, in-lot check, countdown relock, "unlock again" retries, link expiry | `src/logic/guestCheckIn.ts`, `src/app/booking/[id].tsx` |
| Late-return alert (optional) | `src/logic/autoLock.ts` |
| Send the check-in link in Turo: copies the ready-made message (editable in Settings) and opens Turo; "I sent it" logs it | `src/app/booking/[id].tsx`, `src/logic/checkInMessage.ts` |
| Cars & Bookings in one tab with a switch at the top; Bookings has a month calendar (a bar per booked car, tap a day to filter) above the list (employees see trip times only, no money or guest details) | `src/app/(tabs)/cars.tsx`, `src/ui/CarsList.tsx`, `src/ui/BookingsList.tsx`, `src/ui/BookingCalendar.tsx` |
| Money tab (Executive only): month switcher; big numbers with a donut chart alongside; past months show total earned, future months show upcoming; change vs last month; breakdown like Turo's earnings page: trip earnings, upcoming earnings, reimbursements (incl. claim payouts), incentives, missed earnings (not counted in totals); by car; Turo payouts | `src/app/(tabs)/money.tsx`, `src/logic/money.ts`, `src/ui/DonutChart.tsx` |
| Clock in/out; Executive sees everyone's hours | `src/app/(tabs)/hours.tsx` |
| Activity log (person, guest link, auto-lock, system) | `src/app/activity.tsx` |
| Executive settings: every number is adjustable | `src/app/settings.tsx` |
| Team & PINs; optional "employees unlock assigned cars only" | `src/app/team.tsx` |
| Add cars / fill in years | `src/app/fleet.tsx` |

The rules in `src/logic/` are plain TypeScript with no phone code, so they can move to a server unchanged.
Smartcar and Zubie are behind interfaces in `src/services/types.ts`; the pretend version is `src/services/mockFleet.ts`.

## Branding

- Theme: **Royal Gold**: midnight royal purple `#3B1F7A`, dark `#1E0E45`, violet `#7A62B8`, gold `#D4AF37`.
  All colors live in `src/ui/theme.ts`; three other options are kept there for reference.
- Logo/app icons are generated from the theme: `python3 scripts/make-logo.py` (needs Python + Pillow).

## Testing with pretend data

- The **Lexus TX** starts unlocked in the lot, so auto-lock fires within seconds of opening the app.
- The **Nissan Rogue**'s trip ended 90 min ago and it's not back, so a late-return alert fires.
- **Maria's GV70 booking** has its pickup window open. Open the booking, then use the "Simulate" buttons.
- On any car's page (Executive), "Simulate: parked in lot, left unlocked" starts the auto-lock timer.
- Settings → "Reset pretend cars, bookings & activity" starts the pretend data over.

## Next steps (in order)

1. **Backend server** (needed before going live). Auto-lock and guest relock must keep running while
   the phone is asleep, and Smartcar/Zubie keys can't be stored in the app. The server runs
   `planAutomation()` every minute, holds the API keys, serves the guest check-in page, and sends
   push notifications.
2. **Smartcar**: connect each car; confirm all four models are supported.
3. **Zubie**: confirm ZinC API access is in the plan; use its live location and parked/moving status.
4. **Guest check-in web page** at a real address (replaces the `checkin.example.com` placeholder).
5. **Gmail reader** for Turo emails: bookings, changes, cancellations, payouts ("payment sent"), incentives, claims (become tasks), missed earnings, to fill in bookings and the Money tab.
6. **Real home-lot outline.** The current one is a placeholder rectangle near LAX.

## Open questions (from the planning doc)

- Any other cars? (All four are 2026 models, confirmed from Turo emails.)
- Smartcar support for each car
- Home lot exact address
- Should the helper unlock all cars or only assigned ones? (Built as a setting; defaults to all.)
