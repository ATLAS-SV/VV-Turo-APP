import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { IN_LOT } from '../../data/seed';
import { countdownEndsAt, isLinkExpired, pickupWindow, retriesLeft } from '../../logic/guestCheckIn';
import { carName, useNow, useStore } from '../../state/AppStore';
import { Button, Card, Chip, colors, fmtMoney, fmtTime, KeyValue, Muted, Row, Screen, SectionTitle, Title } from '../../ui/components';
import { CHECK_IN_LABEL } from '../../ui/labels';

// Placeholder until the guest check-in web page is deployed.
const CHECK_IN_BASE_URL = 'https://checkin.example.com/c/';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bookings, cars, settings, simulateGuestArrival, simulateDriveOff } = useStore();
  const now = useNow(1000);
  const [msg, setMsg] = useState<string | null>(null);
  const b = bookings.find((x) => x.id === id);
  if (!b) return <Screen><Muted>Booking not found.</Muted></Screen>;

  const car = cars.find((c) => c.id === b.carId);
  const win = pickupWindow(b, settings);
  const link = `${CHECK_IN_BASE_URL}${b.checkInToken}`;
  const expired = isLinkExpired(b, settings, now);
  const endsAt = countdownEndsAt(b, settings);
  const secsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000)) : 0;
  const ci = CHECK_IN_LABEL[b.checkIn.state];

  const run = async (fn: () => Promise<{ ok: boolean; error?: string } | void>, okMsg: string) => {
    const r = await fn();
    setMsg(r && 'ok' in r && !r.ok ? r.error ?? 'Failed' : okMsg);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `${b.guestFirstName}'s trip` }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>{b.guestFirstName}</Title>
          <Title>{fmtMoney(b.earnings)}</Title>
        </Row>
        <KeyValue k="Car" v={carName(car)} />
        <KeyValue k="Trip start" v={fmtTime(b.tripStart)} />
        <KeyValue k="Trip end" v={fmtTime(b.tripEnd)} />
        <KeyValue k="Reservation" v={`#${b.reservationId}`} />
        <KeyValue k="Guest phone" v={b.guestPhone ?? '—'} />
        {b.canceled ? <Chip label="Canceled" tone="bad" /> : null}
      </Card>

      {!b.canceled ? (
        <>
          <SectionTitle>Guest check-in link</SectionTitle>
          <Card>
            <Chip label={ci.label} tone={ci.tone} />
            <KeyValue k="Pickup window" v={`${fmtTime(win.opensAt.toISOString())} → ${fmtTime(win.closesAt.toISOString())}`} />
            <KeyValue k="Unlock-again retries left" v={String(retriesLeft(b, settings))} />
            {endsAt ? (
              <KeyValue k="Relocks in" v={`${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')} unless the car moves`} />
            ) : null}
            <Text selectable style={{ color: colors.primary }}>{link}</Text>
            <Muted>
              The guest page isn’t live yet; this link is a placeholder. Send it in the Turo message thread so
              communication stays on Turo.
            </Muted>
            <Button
              variant="secondary"
              icon="copy"
              label="Copy link"
              disabled={expired}
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                setMsg('Link copied.');
              }}
            />
          </Card>

          <SectionTitle>Test with pretend data</SectionTitle>
          <Card>
            <Muted>Try the guest flow before the real page exists. Uses the same rules the real link will use.</Muted>
            <Button
              variant="secondary"
              icon="location"
              label="Simulate: guest opens link in the lot"
              disabled={expired}
              onPress={() => run(() => simulateGuestArrival(b.id, IN_LOT), 'Guest check-in passed: car unlocked, countdown started.')}
            />
            <Button
              variant="secondary"
              icon="location-outline"
              label="Simulate: guest opens link away from lot"
              disabled={expired}
              onPress={() => run(() => simulateGuestArrival(b.id, { latitude: 34.05, longitude: -118.25 }), '')}
            />
            <Button
              variant="secondary"
              icon="navigate"
              label="Simulate: guest drives off"
              disabled={b.checkIn.state !== 'unlocked'}
              onPress={() => run(() => simulateDriveOff(b.carId), 'Car moved: trip started, link expired.')}
            />
            {msg ? <Muted>{msg}</Muted> : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
