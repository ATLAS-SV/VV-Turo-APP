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
import { DonutChart, type DonutSlice } from '../../ui/DonutChart';
import { SlideOnChange } from '../../ui/motion';
import { EARNING_COLORS, upcomingColor } from '../../ui/earningColors';

/** Earnings by month: big numbers, a donut of where the money came from, by car, and payouts. Executive only. */
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

  return (
    <Screen>
      {/* Month switcher */}
      <Row style={{ justifyContent: 'space-between' }}>
        <ArrowButton icon="chevron-back" label="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{monthLabel(month)}</Text>
          {month !== thisMonth ? (
            <Pressable onPress={() => setMonth(thisMonth)} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>Back to this month</Text>
            </Pressable>
          ) : (
            <Muted style={{ fontSize: 13 }}>This month</Muted>
          )}
        </View>
        <ArrowButton icon="chevron-forward" label="Next month" onPress={() => setMonth(addMonths(month, 1))} />
      </Row>

      {/* The month's numbers slide in from the side you're moving toward. */}
      <SlideOnChange value={month} style={{ gap: 12 }}>
        {/* Big numbers with the donut alongside */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 }}>
          <View style={{ flex: 1, gap: 12 }}>
            {when !== 'future' ? (
              <BigNumber label={when === 'past' ? 'Total earned' : 'Earned so far'} value={sum.earned} size={32} />
            ) : null}
            {when !== 'past' ? (
              <BigNumber label={when === 'future' ? 'Upcoming earnings' : 'Upcoming'} value={sum.upcoming} size={when === 'future' ? 32 : 24} />
            ) : null}
            <View>
              <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>
                {sum.tripCount} {sum.tripCount === 1 ? 'trip' : 'trips'}
              </Text>
              {change !== null ? (
                <Text style={{ fontSize: 13, fontWeight: '600', color: change >= 0 ? colors.locked : colors.danger }}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs {monthLabel(addMonths(month, -1), 'short')}
                </Text>
              ) : null}
            </View>
          </View>
          <DonutChart slices={slices} size={146} centerLabel="Total" centerValue={money0(total)} />
        </Card>

        {/* Each money category in its own box (colors match the donut) */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CategoryBox color={EARNING_COLORS.trip} label="Trip earnings" sub="Completed trips" value={sum.byType.trip.earned} share={pct(sum.byType.trip.earned)} />
          <CategoryBox color={upcomingColor()} label="Upcoming" sub="Comes in after the trips finish" value={sum.upcoming} share={pct(sum.upcoming)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CategoryBox color={EARNING_COLORS.reimbursement} label="Reimbursements" sub="Tolls, fuel, claim payouts" value={reimb} share={pct(reimb)} />
          <CategoryBox color={EARNING_COLORS.incentive} label="Incentives" sub="Turo bonuses" value={incent} share={pct(incent)} />
        </View>
        <CategoryBox color={EARNING_COLORS.missed} label="Missed earnings" sub="Canceled trips, unbilled extras. Not counted in the total." value={sum.missed} muted wide />

        {Object.keys(sum.byCar).length ? (
          <>
            <SectionTitle>By car</SectionTitle>
            <Card>
              {cars
                .filter((c) => sum.byCar[c.id])
                .sort((a, b) => sum.byCar[b.id] - sum.byCar[a.id])
                .map((c) => (
                  <KeyValue key={c.id} k={carName(c)} v={fmtMoney(sum.byCar[c.id])} />
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

/** One money category: color tab, name, amount, share of the month's total. */
function CategoryBox({ color, label, sub, value, share, muted, wide }: { color: string; label: string; sub: string; value: number; share?: string; muted?: boolean; wide?: boolean }) {
  return (
    <View
      accessibilityLabel={`${label}: ${fmtMoney(value)}${share ? `, ${share} of total` : ''}`}
      style={{
        flex: wide ? undefined : 1,
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        paddingTop: 14,
        gap: 4,
        overflow: 'hidden',
        opacity: muted ? 0.85 : 1,
      }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, backgroundColor: color }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color: muted ? colors.muted : colors.text, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={{ color: muted ? colors.muted : colors.text, fontSize: 22, fontWeight: '800' }} adjustsFontSizeToFit numberOfLines={1}>
        {fmtMoney(value)}
      </Text>
      {share ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{share} of total</Text> : null}
      <Muted style={{ fontSize: 12 }}>{sub}</Muted>
    </View>
  );
}

function BigNumber({ label, value, size }: { label: string; value: number; size: number }) {
  return (
    <View>
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Text style={{ fontSize: size, fontWeight: '800', color: colors.text }} adjustsFontSizeToFit numberOfLines={1}>
        {fmtMoney(value)}
      </Text>
    </View>
  );
}

function money0(n: number) {
  return n >= 10_000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString('en-US')}`;
}

function ArrowButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}
