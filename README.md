# Fleet Control — Turo business app

Phone app (iPhone + Android, built with Expo / React Native) for running the Turo fleet:
lock/unlock every car from one screen, see where every car is, auto-lock in the home lot,
guest check-in links, bookings, and employee hours.

**Status: version 1 runs on pretend data.** Smartcar, Zubie and the Gmail booking reader are not connected yet.

## Try it

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. The first launch asks you to set up the
Executive PIN. Press `w` to open a browser preview instead (the map is simplified in the browser).

```bash
npm test          # rules: auto-lock, guest check-in, PIN lockout, roles, hours
npm run typecheck
npx expo lint
```

## What's built

| Area | Where |
| --- | --- |
| PIN sign-in: the PIN decides the person and the role; app locks after 5 wrong tries (5 min, then 10, 20…) | `src/app/sign-in.tsx`, `src/logic/pin.ts` |
| All cars on one screen; one-tap lock, unlock always asks for the PIN | `src/app/(tabs)/index.tsx` |
| Map + trip history (left/back times, distance, stops) | `src/app/(tabs)/map.tsx`, `src/app/car/[id].tsx` |
| Auto-lock: home lot only, parked & unlocked for the set time; notifies + logs | `src/logic/autoLock.ts`, `src/logic/automation.ts` |
| Guest check-in: pickup window, in-lot check, countdown relock, "unlock again" retries, link expiry | `src/logic/guestCheckIn.ts`, `src/app/booking/[id].tsx` |
| Late-return alert (optional) | `src/logic/autoLock.ts` |
| Bookings (employees see trip times only, no money or guest details) | `src/app/(tabs)/bookings.tsx` |
| Clock in/out; Executive sees everyone's hours | `src/app/(tabs)/hours.tsx` |
| Activity log (person, guest link, auto-lock, system) | `src/app/activity.tsx` |
| Executive settings: every number is adjustable | `src/app/settings.tsx` |
| Team & PINs; optional "employees unlock assigned cars only" | `src/app/team.tsx` |
| Add cars / fill in years | `src/app/fleet.tsx` |

The rules in `src/logic/` are plain TypeScript with no phone code, so they can move to a server unchanged.
Smartcar and Zubie are behind interfaces in `src/services/types.ts`; the pretend version is `src/services/mockFleet.ts`.

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
5. **Gmail reader** for Turo booking, change and cancellation emails, to fill in bookings.
6. **Real home-lot outline.** The current one is a placeholder rectangle near LAX.

## Open questions (from the planning doc)

- BMW 3 Series and Nissan Rogue years (editable under More → Cars); any other cars?
- Smartcar support for each car
- Home lot exact address
- Send the check-in link via Turo message or text?
- Should the helper unlock all cars or only assigned ones? (Built as a setting; defaults to all.)
