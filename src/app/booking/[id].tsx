import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { IN_LOT } from '../../data/seed';
import { buildCheckInMessage } from '../../logic/checkInMessage';
import { countdownEndsAt, isLinkExpired, pickupWindow, retriesLeft } from '../../logic/guestCheckIn';
import { carName, useNow, useStore, useTasks } from '../../state/AppStore';
import { TaskRow } from '../../ui/TaskRow';
import { Button, Card, Chip, colors, fmtMoney, fmtTime, KeyValue, Muted, Row, Screen, SectionTitle, Title } from '../../ui/components';
import { CHECK_IN_LABEL } from '../../ui/labels';

// Placeholder until the guest check-in web page is deployed.
const CHECK_IN_BASE_URL = 'https://checkin.example.com/c/';
// Used until each booking's Turo chat link comes in from the Turo emails.
const TURO_FALLBACK_URL = 'https://turo.com';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bookings, cars, settings, markLinkSent, simulateGuestArrival, simulateDriveOff } = useStore();
  const now = useNow(1000);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const tripTasks = useTasks().filter((t) => t.bookingId === id);
  const b = bookings.find((x) => x.id === id);
  if (!b) return <Screen><Muted>Booking not found.</Muted></Screen>;

  const car = cars.find((c) => c.id === b.carId);
  const win = pickupWindow(b, settings);
  const link = `${CHECK_IN_BASE_URL}${b.checkInToken}`;
  const expired = isLinkExpired(b, settings, now);
  const endsAt = countdownEndsAt(b, settings);
  const secsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000)) : 0;
  const ci = CHECK_IN_LABEL[b.checkIn.state];
  const message = buildCheckInMessage(settings.checkInMessageTemplate, {
    guest: b.guestFirstName,
    car: carName(car),
    link,
    window: `${fmtTime(win.opensAt.toISOString())} to ${fmtTime(win.closesAt.toISOString())}`,
    countdown: settings.guestCountdownMinutes,
  });

  const run = async (fn: () => Promise<{ ok: boolean; error?: string } | void>, okMsg: string) => {
    const r = await fn();
    setTestMsg(r && 'ok' in r && !r.ok ? r.error ?? 'Failed' : okMsg);
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
          <SectionTitle>Trip checklist</SectionTitle>
          <Card style={{ gap: 0 }}>
            {tripTasks.map((t) => (
              <TaskRow key={t.id} t={t} now={now} />
            ))}
          </Card>

          <SectionTitle>Guest check-in link</SectionTitle>
          <Card>
            <Chip label={ci.label} tone={ci.tone} />
            <KeyValue k="Pickup window" v={`${fmtTime(win.opensAt.toISOString())} → ${fmtTime(win.closesAt.toISOString())}`} />
            <KeyValue k="Unlock-again retries left" v={String(retriesLeft(b, settings))} />
            {endsAt ? (
              <KeyValue k="Relocks in" v={`${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')} unless the car moves`} />
            ) : null}
            <SectionTitle>Message to {b.guestFirstName}</SectionTitle>
            <Text selectable style={{ color: colors.text, backgroundColor: colors.bg, padding: 10, borderRadius: 8, fontSize: 14, lineHeight: 20 }}>
              {message}
            </Text>
            {b.linkSentAt ? (
              <Chip tone="good" icon="checkmark-circle" label={`Sent in Turo ${fmtTime(b.linkSentAt)}`} />
            ) : (
              <Chip tone="warn" icon="paper-plane" label="Not sent yet" />
            )}
            <Button
              icon="paper-plane"
              label="Send in Turo"
              disabled={expired}
              onPress={async () => {
                await Clipboard.setStringAsync(message);
                setCopied(true);
                setMsg('Message copied. Paste it into the Turo chat and send it, then tap "I sent it".');
                await Linking.openURL(b.turoConversationUrl ?? TURO_FALLBACK_URL).catch(() => {});
              }}
            />
            {copied && !b.linkSentAt ? (
              <Button variant="secondary" icon="checkmark" label="I sent it" onPress={() => { markLinkSent(b.id); setMsg(null); }} />
            ) : null}
            <Muted>
              {b.turoConversationUrl
                ? 'Opens this trip’s Turo chat.'
                : 'Opens Turo. Once the Turo emails are connected, this will open this trip’s chat directly.'}{' '}
              Messages stay on Turo, as Turo requires. The check-in page isn’t live yet, so the link is a placeholder.
            </Muted>
            {msg ? <Muted>{msg}</Muted> : null}
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
            {testMsg ? <Muted>{testMsg}</Muted> : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
