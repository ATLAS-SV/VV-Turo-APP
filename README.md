# VV inc. — Valadon Ventures fleet app

Phone app (iPhone + Android, built with Expo / React Native) for running the Valadon Ventures Turo fleet.
Shows as **VV inc.** on the phone, with the Valadon Ventures logo in the app. It can
lock/unlock every car from one screen, see where every car is, auto-lock in the home lot,
guest check-in links, bookings, and employee hours.

**Status: version 1 runs on pretend data.** Smartcar, Zubie and the Gmail booking reader are not connected yet.

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

- BMW 3 Series and Nissan Rogue years (editable under More → Cars); any other cars?
- Smartcar support for each car
- Home lot exact address
- Should the helper unlock all cars or only assigned ones? (Built as a setting; defaults to all.)
