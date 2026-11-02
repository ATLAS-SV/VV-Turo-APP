import { Pressable, Text, View } from 'react-native';
import { EARNING_LABELS, EARNING_TYPES, monthLabel, type TypeTotals } from '../logic/money';
import type { EarningType } from '../logic/types';
import { colors } from './components';

/** Fixed order, validated for color-blind separation (dataviz validator, light mode). */
export const EARNING_COLORS: Record<EarningType, string> = {
  trip: '#5B3CB0',
  incentive: '#B8860B',
  reimbursement: '#0E8C7E',
  missed: '#D9475F',
};

const UPCOMING_OPACITY = 0.38;
const PLOT_H = 150;

export function money0(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Stacked bars, one per month, split by money type. Solid = earned, faded = upcoming.
 * Tap a bar to switch to that month.
 */
export function EarningsChart({
  data,
  selected,
  onSelect,
}: {
  data: { month: string; byType: TypeTotals }[];
  selected: string;
  onSelect: (month: string) => void;
}) {
  const totals = data.map((d) => EARNING_TYPES.reduce((s, t) => s + d.byType[t].earned + d.byType[t].upcoming, 0));
  const max = Math.max(1, ...totals);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: PLOT_H + 22, borderBottomWidth: 1, borderColor: colors.border }}>
        {data.map((d, i) => {
          const isSel = d.month === selected;
          // Bottom-to-top: earned segments (fixed type order), then upcoming segments.
          const segs = [
            ...EARNING_TYPES.map((t) => ({ t, v: d.byType[t].earned, faded: false })),
            ...EARNING_TYPES.map((t) => ({ t, v: d.byType[t].upcoming, faded: true })),
          ].filter((s) => s.v > 0);
          return (
            <Pressable
              key={d.month}
              onPress={() => onSelect(d.month)}
              accessibilityRole="button"
              accessibilityLabel={`${monthLabel(d.month)}: ${money0(totals[i])}`}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
            >
              {isSel ? (
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{money0(totals[i])}</Text>
              ) : null}
              <View
                style={{
                  width: '58%',
                  flexDirection: 'column-reverse',
                  gap: 2,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  overflow: 'hidden',
                  opacity: isSel ? 1 : 0.8,
                }}
              >
                {segs.map((s, j) => (
                  <View
                    key={j}
                    style={{
                      height: Math.max(2, (s.v / max) * PLOT_H - 2),
                      backgroundColor: EARNING_COLORS[s.t],
                      opacity: s.faded ? UPCOMING_OPACITY : 1,
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {data.map((d) => (
          <Pressable key={d.month} onPress={() => onSelect(d.month)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: d.month === selected ? colors.text : colors.muted, fontWeight: d.month === selected ? '700' : '400' }}>
              {monthLabel(d.month, 'short')}
            </Text>
            {d.month === selected ? <View style={{ width: 16, height: 2, backgroundColor: colors.primary, marginTop: 2, borderRadius: 1 }} /> : null}
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
        {EARNING_TYPES.map((t) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: EARNING_COLORS[t] }} />
            <Text style={{ fontSize: 12, color: colors.muted }}>{EARNING_LABELS[t]}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: EARNING_COLORS.trip, opacity: UPCOMING_OPACITY }} />
          <Text style={{ fontSize: 12, color: colors.muted }}>Lighter = upcoming</Text>
        </View>
      </View>
    </View>
  );
}
