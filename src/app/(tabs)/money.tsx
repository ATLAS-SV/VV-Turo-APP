import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  addMonths,
  earningItems,
  monthKey,
  monthLabel,
  monthWhen,
  summarizeMonth,
} from '../../logic/money';
import { can } from '../../logic/permissions';
import { carName, useNow, useStore } from '../../state/AppStore';
import { Card, colors, fmtMoney, fmtTime, KeyValue, Muted, Row, Screen, SectionTitle } from '../../ui/components';
import { Engine } from '../../ui/Engine';
import { LOGO } from '../../ui/logoColors';
import { getAppearance } from '../../ui/theme';
import { DonutChart, type DonutSlice } from '../../ui/DonutChart';
import { SlideOnChange } from '../../ui/motion';
import { glassFx, isGlass, radius } from '../../ui/bubble';
import { EARNING_COLORS, upcomingColor } from '../../ui/earningColors';

/**
 * Earnings by month (layout R0): the month switcher on the purple band, the big numbers and donut in the
 * train engine, each money category as a small carriage (its windows in the category's color), by car
 * plate-first with a share bar, and payouts. Executive only.
 */
export default function MoneyScreen() {
  const { currentUser, bookings, earningExtras, payouts, cars } = useStore();
  const now = useNow(60_000);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const items = useMemo(() => earningItems(bookings, earningExtras), [bookings, earningExtras]);

  if (!can(currentUser, 'viewEarnings')) {
    return (
      <Screen>
        <Muted>Executives only.</Muted>
      </Screen>
    );
  }

  const when = monthWhen(month, now);
  const sum = summarizeMonth(items, payouts, month, now);
  const thisMonth = monthKey(now);
  const prev = summarizeMonth(items, payouts, addMonths(month, -1), now);
  const total = sum.earned + sum.upcoming;
  const prevTotal = prev.earned + prev.upcoming;
  const change = prevTotal > 0 && when !== 'future' ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const reimb = sum.byType.reimbursement.earned + sum.byType.reimbursement.upcoming;
  const incent = sum.byType.incentive.earned + sum.byType.incentive.upcoming;
  const slices: DonutSlice[] = [
    { key: 'trip', label: 'Trip earnings', value: sum.byType.trip.earned, color: EARNING_COLORS.trip },
    { key: 'upcoming', label: 'Upcoming', value: sum.upcoming, color: upcomingColor() },
    { key: 'reimb', label: 'Reimbursements', value: reimb, color: EARNING_COLORS.reimbursement },
    { key: 'incent', label: 'Incentives', value: incent, color: EARNING_COLORS.incentive },
  ];
  const pct = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '—');
  // On the engine's purple the chart uses lighter versions of the same hues (each still labeled below).
  const engineSlices: DonutSlice[] = slices.map((x) => ({ ...x, color: ON_ENGINE[x.key] ?? x.color }));
  const band = getAppearance() === 'light';
  const byCar = cars.filter((c) => sum.byCar[c.id]).sort((a, b) => sum.byCar[b.id] - sum.byCar[a.id]);
  const topCar = byCar.length ? sum.byCar[byCar[0].id] : 0;

  return (
    <Screen>
      {/* Purple band behind the month switcher and the engine (Light only), like the other tabs. */}
      {band ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundColor: colors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        />
      ) : null}

      {/* Month switcher */}
      <Row style={{ justifyContent: 'space-between' }}>
        <ArrowButton icon="chevron-back" label="Previous month" onBand={band} onPress={() => setMonth(addMonths(month, -1))} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: band ? '#FFFFFF' : colors.text }}>{monthLabel(month)}</Text>
          {month !== thisMonth ? (
            <Pressable onPress={() => setMonth(thisMonth)} accessibilityRole="button">
              <Text style={{ color: band ? LOGO.gold : colors.primary, fontWeight: '700', fontSize: 13 }}>Back to this month</Text>
            </Pressable>
          ) : (
            <Text style={{ color: band ? LOGO.gold : colors.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>THIS MONTH</Text>
          )}
        </View>
        <ArrowButton icon="chevron-forward" label="Next month" onBand={band} onPress={() => setMonth(addMonths(month, 1))} />
      </Row>

      {/* The month's numbers slide in from the side you're moving toward. */}
      <SlideOnChange value={month} style={{ gap: 12 }}>
        {/* Big numbers with the donut alongside, in the train engine */}
        <Engine>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 10 }}>
              {when !== 'future' ? (
                <BigNumber label={when === 'past' ? 'TOTAL EARNED' : 'EARNED SO FAR'} value={sum.earned} size={30} gold />
              ) : null}
              {when !== 'past' ? (
                <BigNumber label={when === 'future' ? 'UPCOMING EARNINGS' : 'UPCOMING'} value={sum.upcoming} size={when === 'future' ? 30 : 22} gold={when === 'future'} />
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <EngineChip label={`${sum.tripCount} ${sum.tripCount === 1 ? 'trip' : 'trips'}`} />
                {change !== null ? (
                  <EngineChip
                    label={`${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs ${monthLabel(addMonths(month, -1), 'short')}`}
                    tone={change >= 0 ? 'up' : 'down'}
                  />
                ) : null}
              </View>
            </View>
            <DonutChart slices={engineSlices} size={136} centerLabel="Total" centerValue={money0(total)} onDark />
          </View>
        </Engine>

        {/* Each money category in its own box (colors match the donut) */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CategoryBox color={EARNING_COLORS.trip} label="Trip earnings" sub="Completed trips" value={sum.byType.trip.earned} share={pct(sum.byType.trip.earned)} />
          <CategoryBox color={upcomingColor()} label="Upcoming" sub="Comes in after the trips finish" value={sum.upcoming} share={pct(sum.upcoming)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CategoryBox color={EARNING_COLORS.reimbursement} label="Reimbursements" sub="Tolls, fuel, claim payouts" value={reimb} share={pct(reimb)} />
          <CategoryBox color={EARNING_COLORS.incentive} label="Incentives" sub="Turo bonuses" value={incent} share={pct(incent)} />
        </View>
        <MissedBox value={sum.missed} />

        {byCar.length ? (
          <>
            <SectionTitle>By car</SectionTitle>
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {byCar.map((c, i) => (
                <View
                  key={c.id}
                  accessibilityLabel={`${c.plate || carName(c)}, ${carName(c)}: ${fmtMoney(sum.byCar[c.id])}`}
                  style={{ paddingVertical: 10, borderBottomWidth: i < byCar.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: c.plate ? 1 : 0, color: colors.text }} numberOfLines={1}>
                      {c.plate?.trim() || `${c.make} ${c.model}`}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 12, color: colors.muted }} numberOfLines={1}>
                      {c.plate?.trim() ? `${c.make} ${c.model}` : ''}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{fmtMoney(sum.byCar[c.id])}</Text>
                  </View>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.neutralBg, marginTop: 6, overflow: 'hidden' }}>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.secondary, width: `${Math.round((sum.byCar[c.id] / topCar) * 100)}%` }} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {when !== 'future' ? (
          <>
            <SectionTitle>Payouts from Turo</SectionTitle>
            <Card>
              {sum.payouts.length ? (
                <>
                  {sum.payouts.map((p) => (
                    <KeyValue key={p.id} k={`${fmtTime(p.sentAt)} · ${p.method}`} v={fmtMoney(p.amount)} />
                  ))}
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                  <KeyValue k="Paid out this month" v={<Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>{fmtMoney(sum.paidOut)}</Text>} />
                </>
              ) : (
                <Muted>No payouts this month.</Muted>
              )}
              <Muted style={{ fontSize: 12 }}>
                Pretend data. Later these come from Turo’s payment emails in Gmail, so payouts may land a few days after the
                trips they cover.
              </Muted>
            </Card>
          </>
        ) : null}
      </SlideOnChange>
    </Screen>
  );
}

/** One money category as a small carriage: windows in its color, name, amount, share of the month's total. */
function CategoryBox({ color, label, sub, value, share }: { color: string; label: string; sub: string; value: number; share?: string }) {
  return (
    <View
      accessibilityLabel={`${label}: ${fmtMoney(value)}${share ? `, ${share} of total` : ''}`}
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderTopLeftRadius: radius() + 2,
        borderTopRightRadius: radius() + 2,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12,
        paddingTop: 17,
        paddingBottom: 12,
        gap: 2,
        ...glassFx(),
        ...(isGlass() ? {} : { shadowColor: '#1E0E45', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }),
      }}
    >
      {/* window strip */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 7, left: 12, right: 12, flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2, 3].map((w) => (
          <View key={w} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: color }} />
        ))}
      </View>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800' }} adjustsFontSizeToFit numberOfLines={1}>
        {fmtMoney(value)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
        {share ? `${share} · ` : ''}
        {sub}
      </Text>
    </View>
  );
}

/** Missed earnings: dashed, off to the side; never part of the total. */
function MissedBox({ value }: { value: number }) {
  return (
    <View
      accessibilityLabel={`Missed earnings: ${fmtMoney(value)}. Not counted in the total.`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: radius(),
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: EARNING_COLORS.missed,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: EARNING_COLORS.missed }}>Missed earnings</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>Canceled trips, unbilled extras. Not in the total.</Text>
      </View>
      <Text style={{ fontSize: 19, fontWeight: '800', color: EARNING_COLORS.missed }}>{fmtMoney(value)}</Text>
    </View>
  );
}

function EngineChip({ label, tone }: { label: string; tone?: 'up' | 'down' }) {
  const bg = tone === 'up' ? '#9BE3B5' : tone === 'down' ? '#F6B3BE' : 'rgba(255,255,255,0.16)';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: tone ? LOGO.to : '#FFFFFF' }}>{label}</Text>
    </View>
  );
}

/** A big number on the engine: small caps label (gold for the headline number) over white digits. */
function BigNumber({ label, value, size, gold = false }: { label: string; value: number; size: number; gold?: boolean }) {
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: gold ? LOGO.gold : '#D9CCF7' }}>{label}</Text>
      <Text style={{ fontSize: size, fontWeight: '800', color: '#FFFFFF' }} adjustsFontSizeToFit numberOfLines={1}>
        {fmtMoney(value)}
      </Text>
    </View>
  );
}

function money0(n: number) {
  return n >= 10_000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString('en-US')}`;
}

function ArrowButton({ icon, label, onPress, onBand }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void; onBand: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: onBand ? 'rgba(255,255,255,0.14)' : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: onBand ? 0 : 1,
        borderColor: colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={onBand ? '#FFFFFF' : colors.primary} />
    </Pressable>
  );
}

/** Donut colors on the engine's purple: lighter versions of the category hues. */
const ON_ENGINE: Record<string, string> = {
  trip: '#A48CF0',
  upcoming: 'rgba(255,255,255,0.45)',
  reimb: '#2EC4AE',
  incent: LOGO.gold,
};
