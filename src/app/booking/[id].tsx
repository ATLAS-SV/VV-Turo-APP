import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View, type ViewStyle } from 'react-native';
import { IN_LOT } from '../../data/seed';
import { bookingStatus } from '../../logic/bookings';
import { buildCheckInMessage } from '../../logic/checkInMessage';
import { isInLot } from '../../logic/geo';
import { countdownEndsAt, isLinkExpired, pickupWindow, retriesLeft } from '../../logic/guestCheckIn';
import { canUnlockCar } from '../../logic/permissions';
import type { Booking } from '../../logic/types';
import { ACTION_LABELS, carName, useNow, useStore, useTasks } from '../../state/AppStore';
import { LOGO_SERIF } from '../../ui/Brand';
import { glassFx, isGlass, PopIn, radius } from '../../ui/bubble';
import { ChecklistStamps, STAMP_KINDS } from '../../ui/ChecklistStamps';
import { Button, Card, Chip, colors, fmtAgo, fmtClock, fmtMoney, fmtTime, type IconName, LockChip, Muted, Row, Screen, SectionTitle } from '../../ui/components';
import { CHECK_IN_LABEL } from '../../ui/labels';
import { TaskRow } from '../../ui/TaskRow';
import { getAppearance, theme } from '../../ui/theme';
import { fmtDay, Perforation, stubColor, ticketShadow } from '../../ui/ticket';
import { UnlockPrompt } from '../../ui/UnlockPrompt';

// Placeholder until the guest check-in web page is deployed.
const CHECK_IN_BASE_URL = 'https://checkin.example.com/c/';
// Used until each booking's Turo chat link comes in from the Turo emails.
const TURO_FALLBACK_URL = 'https://turo.com';

/** "Starts in 20 min", "On trip · back Thu 3:44 AM", … shown above the ticket. */
function statusLine(b: Booking, now: Date) {
  const st = bookingStatus(b, now);
  if (st === 'canceled') return 'Canceled';
  if (st === 'completed') return 'Trip ended';
  if (st === 'active') return `On trip · back ${fmtDay(b.tripEnd)}`;
  const mins = Math.round((Date.parse(b.tripStart) - now.getTime()) / 60_000);
  if (mins <= 0) return 'Pickup time';
  if (mins < 60) return `Starts in ${mins} min`;
  if (mins < 48 * 60) return `Starts in ${Math.round(mins / 60)} h`;
  return `Starts ${fmtDay(b.tripStart)}`;
}

/**
 * Booking page: a trip "ticket" (pickup → return, guest, car) with the checklist as stamps
 * on its stub, then tiles: check-in link, car with Lock / Unlock, earnings, guest, car activity.
 */
export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bookings, cars, settings, telemetry, busyCars, currentUser, activity, lockCar, markLinkSent, simulateGuestArrival, simulateDriveOff } = useStore();
  const now = useNow(1000);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [carMsg, setCarMsg] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const tripTasks = useTasks().filter((t) => t.bookingId === id);
  const b = bookings.find((x) => x.id === id);
  if (!b) return <Screen><Muted>Booking not found.</Muted></Screen>;

  const car = cars.find((c) => c.id === b.carId);
  const tel = telemetry[b.carId];
  const busy = busyCars[b.carId];
  const inLot = tel ? isInLot(tel.position, settings.homeLot) : false;
  const win = pickupWindow(b, settings);
  const link = `${CHECK_IN_BASE_URL}${b.checkInToken}`;
  const expired = isLinkExpired(b, settings, now);
  const endsAt = countdownEndsAt(b, settings);
  const secsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000)) : 0;
  const ci = CHECK_IN_LABEL[b.checkIn.state];
  const retries = retriesLeft(b, settings);
  const days = Math.max(1, Math.round((Date.parse(b.tripEnd) - Date.parse(b.tripStart)) / 86_400_000));
  const stampTasks = tripTasks.filter((t) => STAMP_KINDS[t.kind]);
  const otherTasks = tripTasks.filter((t) => !STAMP_KINDS[t.kind]);
  const carActivity = activity.filter((a) => a.carId === b.carId && !a.action.startsWith('task_') && Date.parse(a.at) >= Date.parse(b.tripStart) - 2 * 86_400_000).slice(0, 3);
  const message = buildCheckInMessage(settings.checkInMessageTemplate, {
    guest: b.guestFirstName,
    car: carName(car),
    link,
    window: `${fmtTime(win.opensAt.toISOString())} to ${fmtTime(win.closesAt.toISOString())}`,
    countdown: settings.guestCountdownMinutes,
  });

  // Purple band behind the ticket in Light (the dark looks are already purple; it would muddy frosted glass).
  const look = getAppearance();
  const band = look === 'light' ? theme.primary : null;
  const onBand = band ? '#FFFFFF' : colors.text;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string } | void>, okMsg: string) => {
    const r = await fn();
    setTestMsg(r && 'ok' in r && !r.ok ? r.error ?? 'Failed' : okMsg);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `${b.guestFirstName}'s trip` }} />
      {band ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundColor: band, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: onBand, fontSize: 15, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
          {b.guestFirstName} · {fmtMoney(b.earnings)}
        </Text>
        <View style={{ backgroundColor: b.canceled ? colors.dangerBg : 'rgba(212,175,55,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: b.canceled ? colors.danger : band ? '#F7DE8A' : colors.primary, fontSize: 12, fontWeight: '800' }}>{statusLine(b, now)}</Text>
        </View>
      </View>

      {/* ---------- Ticket ---------- */}
      <PopIn>
        <View style={[{ backgroundColor: colors.card, borderRadius: radius() + 6, overflow: 'hidden', borderWidth: isGlass() ? 1 : 0, borderColor: colors.border }, ticketShadow(), glassFx()]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: stubColor() }}>
            <Text style={{ fontFamily: LOGO_SERIF, fontSize: 22, fontWeight: '700', color: colors.primary }}>VV</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: look === 'light' ? '#92400E' : colors.muted, letterSpacing: 0.4 }}>RES #{b.reservationId}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 }}>
            <TimeBlock label="PICKUP" iso={b.tripStart} />
            <View style={{ flex: 1, marginHorizontal: 12, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>
                {days} {days === 1 ? 'day' : 'days'}
              </Text>
              <View style={{ alignSelf: 'stretch', borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.secondary }} />
            </View>
            <TimeBlock label="RETURN" iso={b.tripEnd} right />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingBottom: 12 }}>
            <Field label="GUEST" value={b.guestFirstName} style={{ flex: 1 }} />
            <Field label="CAR" value={carName(car)} style={{ flex: 1.6 }} />
          </View>
          {b.canceled ? (
            <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
              <Chip label="Canceled" tone="bad" />
            </View>
          ) : null}

          {!b.canceled && stampTasks.length ? (
            <>
              <Perforation />
              <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 16 }}>
                <ChecklistStamps tasks={stampTasks} now={now} />
              </View>
            </>
          ) : null}
        </View>
      </PopIn>

      {/* ---------- Check-in link ---------- */}
      {!b.canceled ? (
        <Tile delay={70} style={{ borderWidth: 2, borderColor: theme.accent }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <TileLabel icon="key">CHECK-IN LINK</TileLabel>
            <Chip label={ci.label} tone={ci.tone} />
          </Row>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
            Window {fmtClock(win.opensAt.toISOString())} – {fmtClock(win.closesAt.toISOString())} · {retries} unlock {retries === 1 ? 'retry' : 'retries'} left
          </Text>
          {endsAt ? (
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.unlocked }}>
              Relocks in {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')} unless the car moves
            </Text>
          ) : null}
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
            <Button
              variant="secondary"
              icon="checkmark"
              label="I sent it"
              onPress={() => {
                markLinkSent(b.id);
                setMsg(null);
              }}
            />
          ) : null}
          {msg ? <Muted>{msg}</Muted> : null}
          <Pressable onPress={() => setShowMessage((v) => !v)} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{showMessage ? 'Hide message' : `See the message to ${b.guestFirstName}`}</Text>
            <Ionicons name={showMessage ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
          </Pressable>
          {showMessage ? (
            <>
              <Text
                selectable
                style={{ color: colors.text, backgroundColor: colors.neutralBg, padding: 10, borderRadius: 10, fontSize: 14, lineHeight: 20, borderLeftWidth: 3, borderLeftColor: theme.accent }}
              >
                {message}
              </Text>
              <Muted>
                {b.turoConversationUrl
                  ? 'Send in Turo opens this trip’s Turo chat.'
                  : 'Send in Turo opens Turo. Once the Turo emails are connected, it will open this trip’s chat directly.'}{' '}
                Messages stay on Turo, as Turo requires. The check-in page isn’t live yet, so the link is a placeholder.
              </Muted>
            </>
          ) : null}
        </Tile>
      ) : null}

      {/* ---------- Car: lock / unlock by hand ---------- */}
      {car ? (
        <Tile delay={140}>
          <Pressable onPress={() => router.push(`/car/${car.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${carName(car)}`} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <TileLabel icon="car-sport">CAR</TileLabel>
              <Row style={{ gap: 6 }}>
                <LockChip state={tel?.lockState} />
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </Row>
            </Row>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{carName(car)}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: inLot ? colors.locked : colors.muted }}>
              {tel ? `${inLot ? `● ${settings.homeLot.name}` : tel.moving ? 'Driving' : 'Away from home lot'} · updated ${fmtAgo(tel.updatedAt, now)}` : 'No location yet'}
            </Text>
          </Pressable>
          <Row>
            <Button
              style={{ flex: 1 }}
              variant="secondary"
              icon="lock-closed"
              label="Lock"
              busy={busy === 'locking'}
              disabled={!!busy}
              onPress={async () => {
                const r = await lockCar(car.id);
                setCarMsg(r.ok ? 'Locked.' : r.error ?? 'Couldn’t lock.');
              }}
            />
            <Button
              style={{ flex: 1 }}
              icon="lock-open"
              label="Unlock"
              busy={busy === 'unlocking'}
              disabled={!!busy || !canUnlockCar(currentUser, car.id, settings)}
              onPress={() => {
                setCarMsg(null);
                setUnlocking(true);
              }}
            />
          </Row>
          <Muted style={{ fontSize: 12 }}>{carMsg ?? 'Unlock asks for your PIN.'}</Muted>
        </Tile>
      ) : null}

      {/* ---------- Earnings + guest ---------- */}
      <Row style={{ alignItems: 'stretch' }}>
        <Tile delay={210} style={{ flex: 1, justifyContent: 'space-between' }}>
          <TileLabel icon="cash">YOU EARN</TileLabel>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{fmtMoney(b.earnings)}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>{fmtMoney(b.earnings / days)} / day</Text>
          </View>
        </Tile>
        <Tile delay={250} style={{ flex: 1, justifyContent: 'space-between' }}>
          <TileLabel icon="person">GUEST</TileLabel>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }} numberOfLines={1}>
              {b.guestFirstName}
            </Text>
            {b.guestPhone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${b.guestPhone!.replace(/[^\d+]/g, '')}`).catch(() => {})} accessibilityRole="link" hitSlop={8}>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>{b.guestPhone}</Text>
              </Pressable>
            ) : (
              <Text style={{ fontSize: 13, color: colors.muted }}>No phone</Text>
            )}
          </View>
        </Tile>
      </Row>

      {/* ---------- Car activity around this trip ---------- */}
      <Tile delay={290}>
        <Pressable onPress={() => router.push('/activity')} accessibilityRole="button" accessibilityLabel="Open the activity log">
          <Row style={{ justifyContent: 'space-between' }}>
            <TileLabel icon="time">CAR ACTIVITY</TileLabel>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </Row>
        </Pressable>
        {carActivity.length ? (
          carActivity.map((a) => (
            <Row key={a.id} style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                {ACTION_LABELS[a.action]}
                {a.detail ? <Text style={{ color: colors.muted, fontWeight: '400' }}> · {a.detail}</Text> : null}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, flexShrink: 0 }} numberOfLines={1}>{fmtAgo(a.at, now)}</Text>
            </Row>
          ))
        ) : (
          <Muted>Nothing yet for this trip.</Muted>
        )}
      </Tile>

      {!b.canceled && otherTasks.length ? (
        <>
          <SectionTitle>Other tasks</SectionTitle>
          <Card style={{ gap: 0 }}>
            {otherTasks.map((t) => (
              <TaskRow key={t.id} t={t} now={now} />
            ))}
          </Card>
        </>
      ) : null}

      {!b.canceled ? (
        <>
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
              onPress={() => run(() => simulateGuestArrival(b.id, { latitude: 32.711, longitude: -117.16 }), '')}
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
      <UnlockPrompt carId={unlocking ? b.carId : null} onClose={() => setUnlocking(false)} />
    </Screen>
  );
}

function TimeBlock({ label, iso, right }: { label: string; iso: string; right?: boolean }) {
  const [time, ampm] = fmtClock(iso).split(/\s(?=[AP]M$)/i);
  return (
    <View style={{ alignItems: right ? 'flex-end' : 'flex-start' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>
        {time}
        {ampm ? <Text style={{ fontSize: 14 }}> {ampm}</Text> : null}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{fmtDay(iso)}</Text>
    </View>
  );
}

function Field({ label, value, style }: { label: string; value: string; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** A rounded box on the booking page; pops in after the ticket. */
function Tile({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const half = style?.flex ? { flex: 1 } : undefined;
  return (
    <PopIn delay={delay} style={half}>
      <View
        style={[
          { backgroundColor: colors.card, borderRadius: radius() + 4, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
          glassFx(),
          style,
          half,
        ]}
      >
        {children}
      </View>
    </PopIn>
  );
}

function TileLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.6 }}>{children}</Text>
    </View>
  );
}
