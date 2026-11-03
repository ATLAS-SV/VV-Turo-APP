import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from './components';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

const GAP_DEG = 2.5; // small surface gap between slices

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Ring slice from a0 to a1 degrees (0 = top, clockwise). */
function slicePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, a0);
  const o1 = polar(cx, cy, rOuter, a1);
  const i1 = polar(cx, cy, rInner, a1);
  const i0 = polar(cx, cy, rInner, a0);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

/** Donut chart with the total in the middle. `onDark` draws it for the purple engine (light text, dark center). */
export function DonutChart({
  slices,
  size = 150,
  centerLabel,
  centerValue,
  onDark = false,
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel: string;
  centerValue: string;
  onDark?: boolean;
}) {
  const parts = slices.filter((s) => s.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const c = size / 2;
  const rOuter = c - 2;
  const rInner = rOuter * 0.64;
  let angle = 0;
  const gap = parts.length > 1 ? GAP_DEG : 0;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel={`${centerLabel} ${centerValue}. ${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}`}
    >
      <Svg width={size} height={size}>
        {onDark ? <Circle cx={c} cy={c} r={rInner - 1} fill="rgba(20,8,60,0.55)" /> : null}
        {total === 0 ? (
          <Circle cx={c} cy={c} r={(rOuter + rInner) / 2} stroke={onDark ? 'rgba(255,255,255,0.2)' : colors.border} strokeWidth={rOuter - rInner} fill="none" />
        ) : parts.length === 1 ? (
          <Circle cx={c} cy={c} r={(rOuter + rInner) / 2} stroke={parts[0].color} strokeWidth={rOuter - rInner} fill="none" />
        ) : (
          parts.map((p) => {
            const sweep = (p.value / total) * 360;
            const a0 = angle + gap / 2;
            const a1 = angle + Math.max(sweep - gap / 2, gap / 2 + 0.5);
            angle += sweep;
            return <Path key={p.key} d={slicePath(c, c, rOuter, rInner, a0, a1)} fill={p.color} />;
          })
        )}
      </Svg>
      {centerLabel || centerValue ? (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Text style={{ fontSize: 11, color: onDark ? '#D9CCF7' : colors.muted }}>{centerLabel}</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: onDark ? '#FFFFFF' : colors.text }}>{centerValue}</Text>
        </View>
      ) : null}
    </View>
  );
}
