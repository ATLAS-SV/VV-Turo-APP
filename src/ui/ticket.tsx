// Shared "ticket" look: the booking page's trip pass and the mini tickets in the bookings list.
import { View, type ViewStyle } from 'react-native';
import { isGlass } from './bubble';
import { colors } from './components';
import { getAppearance, type Appearance } from './theme';

export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** Ticket stub color: warm cream on Light, a soft tint elsewhere. */
export const stubColor = () => (getAppearance() === 'light' ? '#FBF7EA' : colors.neutralBg);

export function ticketShadow(): ViewStyle {
  if (isGlass()) return {};
  return { shadowColor: '#1E0E45', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 };
}

/**
 * Notches: half-circle bites out of the ticket at each end of the tear line. Over solid pages they
 * read as holes through to the page; over frosted glass they're a darker/lighter tint instead.
 */
const NOTCH: Record<Appearance, () => { fill: string; edge: string }> = {
  light: () => ({ fill: '#EAE4F4', edge: '#D6CDE9' }),
  dark: () => ({ fill: '#12062E', edge: colors.border }),
  glass: () => ({ fill: 'rgba(12,2,40,0.7)', edge: 'rgba(255,255,255,0.3)' }),
  glassLight: () => ({ fill: 'rgba(90,60,170,0.26)', edge: 'rgba(255,255,255,0.95)' }),
};

function Notch({ size, style }: { size: number; style: ViewStyle }) {
  const n = NOTCH[getAppearance()]();
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: n.fill, borderWidth: 1.5, borderColor: n.edge }, style]}
    />
  );
}

/** Horizontal tear line across the ticket, with a notch on the left and right edges. */
export function Perforation({ size = 32 }: { size?: number }) {
  return (
    <View style={{ height: size, justifyContent: 'center' }}>
      <Notch size={size} style={{ left: -size / 2 }} />
      <Notch size={size} style={{ right: -size / 2 }} />
      <View style={{ marginHorizontal: size / 2 + 6, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.border }} />
    </View>
  );
}

/** Vertical tear line between a ticket and its stub, with a notch at the top and bottom edges. */
export function VPerforation({ size = 22 }: { size?: number }) {
  return (
    <View style={{ width: size, alignItems: 'center', alignSelf: 'stretch' }}>
      <Notch size={size} style={{ top: -size / 2 }} />
      <Notch size={size} style={{ bottom: -size / 2 }} />
      <View style={{ flex: 1, marginVertical: size / 2 + 4, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.border }} />
    </View>
  );
}
