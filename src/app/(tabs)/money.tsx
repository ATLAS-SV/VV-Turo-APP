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
import { EARNING_COLORS, EarningsChart } from '../../ui/EarningsChart';

/** Earnings by month, like Turo's earnings page: earned, upcoming, by type, and payouts. Executive only. */
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
  const chartMonths = [-3, -2, -1, 0, 1, 2].map((o) => addMonths(month, o));
  const chartData = chartMonths.map((m) => ({ month: m, byType: summarizeMonth(items, payouts, m, now).byType }));
  const thisMonth = monthKey(now);

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

      {/* Headline numbers */}
      <Card style={{ flexDirection: 'row', gap: 12 }}>
        {when !== 'future' ? <Stat label={when === 'past' ? 'Total earned' : 'Earned so far'} value={sum.earned} big /> : null}
        {when !== 'past' ? <Stat label={when === 'future' ? 'Upcoming earnings' : 'Upcoming'} value={sum.upcoming} big={when === 'future'} /> : null}
        <Stat label="Trips" value={sum.tripCount} plain />
      </Card>

      <Card>
        <EarningsChart data={chartData} selected={month} onSelect={setMonth} />
      </Card>

      <SectionTitle>Breakdown</SectionTitle>
      <Card>
        <BreakdownRow color={EARNING_COLORS.trip} label="Trip earnings" sub="Completed trips" value={sum.byType.trip.earned} />
        <BreakdownRow color={EARNING_COLORS.trip} faded label="Upcoming earnings" sub="Comes in after the trips finish" value={sum.upcoming} />
        <BreakdownRow
          color={EARNING_COLORS.reimbursement}
          label="Reimbursements"
          sub="Tolls, fuel, claim payouts"
          value={sum.byType.reimbursement.earned + sum.byType.reimbursement.upcoming}
        />
        <BreakdownRow color={EARNING_COLORS.incentive} label="Incentives" sub="Turo bonuses" value={sum.byType.incentive.earned + sum.byType.incentive.upcoming} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <BreakdownRow color={EARNING_COLORS.missed} label="Missed earnings" sub="Canceled trips, unbilled extras. Not in the totals." value={sum.missed} muted />
      </Card>

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
    </Screen>
  );
}

function BreakdownRow({ color, label, sub, value, faded, muted }: { color: string; label: string; sub: string; value: number; faded?: boolean; muted?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3, alignItems: 'flex-start' }}>
      <Row style={{ flex: 1, alignItems: 'flex-start' }}>
        <View style={{ width: 12, height: 12, borderRadius: 3, marginTop: 4, backgroundColor: color, opacity: faded ? 0.38 : 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: muted ? colors.muted : colors.text, fontSize: 15 }}>{label}</Text>
          <Muted style={{ fontSize: 12 }}>{sub}</Muted>
        </View>
      </Row>
      <Text style={{ color: muted ? colors.muted : colors.text, fontSize: 15, fontWeight: '600' }}>{fmtMoney(value)}</Text>
    </Row>
  );
}

function Stat({ label, value, big, plain }: { label: string; value: number; big?: boolean; plain?: boolean }) {
  return (
    <View style={{ flex: plain ? 0.6 : 1, gap: 2 }}>
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Text style={{ fontSize: big ? 26 : 20, fontWeight: '800', color: colors.text }}>{plain ? value : fmtMoney(value)}</Text>
    </View>
  );
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
