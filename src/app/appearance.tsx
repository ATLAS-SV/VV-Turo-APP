import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../state/AppStore';
import { colors, Muted, Screen } from '../ui/components';
import { theme, type Appearance } from '../ui/theme';

type Preview = { label: string; sub: string; bg: string; card: string; line: string; text: string; button: string; glass?: { blobA: string; blobB: string; ring: string } };

/** Each option shows a small preview of the app in that look, drawn with that look's own colors. */
const PREVIEW: Record<Appearance, Preview> = {
  light: { label: 'Light', sub: 'Bright and clean', bg: theme.background, card: '#FFFFFF', line: '#E3E5EA', text: '#14171F', button: theme.primary },
  dark: { label: 'Dark', sub: 'The logo’s purple', bg: theme.primaryDark, card: '#2A1856', line: '#3D2B70', text: '#F5EFE0', button: theme.accent },
  glassLight: {
    label: 'Glass Light',
    sub: 'Frosted white & bubbly',
    bg: '#F1EAFF',
    card: 'rgba(255,255,255,0.6)',
    line: 'rgba(255,255,255,0.95)',
    text: '#1D1340',
    button: theme.primary,
    glass: { blobA: 'rgba(196,176,255,0.75)', blobB: 'rgba(246,212,126,0.6)', ring: 'rgba(140,110,230,0.45)' },
  },
  glass: {
    label: 'Glass Dark',
    sub: 'Frosted purple & bubbly',
    bg: '#2C1270',
    card: 'rgba(255,255,255,0.14)',
    line: 'rgba(255,255,255,0.28)',
    text: '#FBF8FF',
    button: '#F4CF5E',
    glass: { blobA: 'rgba(139,92,246,0.55)', blobB: 'rgba(212,175,55,0.35)', ring: 'rgba(255,255,255,0.5)' },
  },
};

const ORDER: Appearance[][] = [
  ['light', 'dark'],
  ['glassLight', 'glass'],
];

/** More → Appearance: Light, Dark, Glass Light or Glass Dark, chosen per phone. */
export default function AppearanceScreen() {
  const { appearance, setAppearance } = useStore();
  return (
    <Screen>
      <Muted>Choose how the app looks on this phone. Everyone can pick their own.</Muted>
      {ORDER.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((a) => (
            <Option key={a} p={PREVIEW[a]} selected={appearance === a} onPick={() => setAppearance(a)} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function Option({ p, selected, onPick }: { p: Preview; selected: boolean; onPick: () => void }) {
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${p.label} appearance`}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: 16,
        padding: 8,
        gap: 8,
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* mini phone */}
      <View style={{ backgroundColor: p.bg, borderRadius: p.glass ? 16 : 10, padding: 8, gap: 6, height: 150, overflow: 'hidden' }}>
        {p.glass ? (
          <>
            <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, left: -30, top: 10, backgroundColor: p.glass.blobA }} />
            <View style={{ position: 'absolute', width: 70, height: 70, borderRadius: 35, right: -20, bottom: 6, backgroundColor: p.glass.blobB }} />
            <View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, right: 14, top: 26, borderWidth: 1, borderColor: p.glass.ring }} />
            <View style={{ position: 'absolute', width: 7, height: 7, borderRadius: 4, left: 18, bottom: 16, borderWidth: 1, borderColor: p.glass.ring }} />
          </>
        ) : null}
        <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: theme.primaryDark, borderWidth: 1, borderColor: theme.accent }} />
        {[0, 1].map((i) => (
          <View key={i} style={{ backgroundColor: p.card, borderRadius: p.glass ? 12 : 8, padding: 7, gap: 5, borderWidth: 1, borderColor: p.line }}>
            <View style={{ width: '70%', height: 6, borderRadius: 3, backgroundColor: p.text, opacity: 0.85 }} />
            <View style={{ width: '45%', height: 5, borderRadius: 3, backgroundColor: p.text, opacity: 0.35 }} />
            <View style={{ alignSelf: 'flex-end', width: 30, height: 12, borderRadius: 6, backgroundColor: p.button }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{p.label}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{p.sub}</Text>
        </View>
      </View>
    </Pressable>
  );
}
