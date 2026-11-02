import { Ionicons } from '@expo/vector-icons';
import { useRef, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type HostInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LockState } from '../logic/types';
import { useStore } from '../state/AppStore';
import { useExpand } from './expandContext';

import { theme } from './theme';

export const colors = {
  bg: theme.background,
  card: '#FFFFFF',
  text: '#14171F',
  muted: '#646B78',
  border: '#E3E5EA',
  primary: theme.primary,
  primaryDark: theme.primaryDark,
  secondary: theme.secondary,
  accent: theme.accent,
  primaryText: '#FFFFFF',
  locked: '#15803D',
  lockedBg: '#E7F6EC',
  unlocked: '#B45309',
  unlockedBg: '#FDF1E3',
  danger: '#B91C1C',
  dangerBg: '#FDECEC',
  neutralBg: theme.secondarySoft,
};

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, padTop = false }: { children: ReactNode; scroll?: boolean; padTop?: boolean }) {
  const insets = useSafeAreaInsets();
  const style = { padding: 16, paddingTop: padTop ? insets.top + 16 : 16, paddingBottom: insets.bottom + 24, gap: 12 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={style}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  const body = (
    <View ref={ref} style={[s.card, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  // Tapping a card grows it into the page it opens.
  return (
    <Pressable onPress={() => expand(ref.current, onPress)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = {
    primary: { bg: colors.primary, fg: colors.primaryText },
    secondary: { bg: colors.neutralBg, fg: colors.text },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary },
  }[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: v.bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={v.fg} /> : icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
      <Text style={[s.buttonText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' | 'info'; icon?: IconName }) {
  const t = {
    good: [colors.lockedBg, colors.locked],
    warn: [colors.unlockedBg, colors.unlocked],
    bad: [colors.dangerBg, colors.danger],
    neutral: [colors.neutralBg, colors.muted],
    info: [theme.secondarySoft, colors.primary],
  }[tone];
  return (
    <View style={[s.chip, { backgroundColor: t[0] }]}>
      {icon ? <Ionicons name={icon} size={13} color={t[1]} /> : null}
      <Text style={[s.chipText, { color: t[1] }]}>{label}</Text>
    </View>
  );
}

export function LockChip({ state }: { state: LockState | undefined }) {
  if (state === 'locked') return <Chip label="Locked" tone="good" icon="lock-closed" />;
  if (state === 'unlocked') return <Chip label="Unlocked" tone="warn" icon="lock-open" />;
  return <Chip label="Unknown" icon="help-circle" />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <View style={s.kv}>
      <Text style={s.muted}>{k}</Text>
      {typeof v === 'string' ? <Text style={s.kvValue}>{v}</Text> : v}
    </View>
  );
}

export function ListItem({ icon, label, sub, onPress, right }: { icon: IconName; label: string; sub?: string; onPress?: () => void; right?: ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.listItem, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.kvValue, { textAlign: 'left' }]}>{label}</Text>
        {sub ? <Text style={s.muted}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

/** Owner notifications (auto-lock, guest unlocks, alerts) shown as banners. */
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[s.toastWrap, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <Pressable key={t.id} onPress={() => dismissToast(t.id)} style={s.toast} accessibilityRole="alert">
          <Ionicons name="notifications" size={18} color="#fff" />
          <Text style={s.toastText}>{t.text}</Text>
          <Ionicons name="close" size={16} color="#C9CDD6" />
        </Pressable>
      ))}
    </View>
  );
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtAgo(iso: string | null | undefined, now: Date) {
  if (!iso) return '—';
  const m = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function fmtMoney(n: number) {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, minHeight: 46 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kvValue: { color: colors.text, fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  toastWrap: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1F2430', padding: 12, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  toastText: { color: '#fff', flex: 1, fontSize: 14 },
});
