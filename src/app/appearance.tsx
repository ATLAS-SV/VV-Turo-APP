import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../state/AppStore';
import { colors, Muted, Screen } from '../ui/components';
import { theme, type Appearance } from '../ui/theme';

/** Each option shows a small preview of the app in that look, drawn with that look's own colors. */
const PREVIEW: Record<Appearance, { label: string; sub: string; bg: string; card: string; line: string; text: string; button: string; buttonText: string }> = {
  light: { label: 'Light', sub: 'Light background, purple buttons', bg: theme.background, card: '#FFFFFF', line: '#E3E5EA', text: '#14171F', button: theme.primary, buttonText: '#FFFFFF' },
  dark: { label: 'Dark', sub: 'The logo’s deep purple, gold buttons', bg: theme.primaryDark, card: '#2A1856', line: '#3D2B70', text: '#F5EFE0', button: theme.accent, buttonText: theme.primaryDark },
};

/** More → Appearance: switch this phone between light and dark. */
export default function AppearanceScreen() {
  const { appearance, setAppearance } = useStore();
  return (
    <Screen>
      <Muted>Choose how the app looks on this phone. Everyone can pick their own.</Muted>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['light', 'dark'] as const).map((a) => {
          const p = PREVIEW[a];
          const selected = appearance === a;
          return (
            <Pressable
              key={a}
              onPress={() => setAppearance(a)}
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
              <View style={{ backgroundColor: p.bg, borderRadius: 10, padding: 8, gap: 6, height: 170 }}>
                <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: theme.primaryDark, borderWidth: 1, borderColor: theme.accent }} />
                {[0, 1].map((i) => (
                  <View key={i} style={{ backgroundColor: p.card, borderRadius: 8, padding: 7, gap: 5, borderWidth: 1, borderColor: p.line }}>
                    <View style={{ width: '70%', height: 6, borderRadius: 3, backgroundColor: p.text, opacity: 0.85 }} />
                    <View style={{ width: '45%', height: 5, borderRadius: 3, backgroundColor: p.text, opacity: 0.35 }} />
                    <View style={{ alignSelf: 'flex-end', width: 34, height: 12, borderRadius: 6, backgroundColor: p.button }} />
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
        })}
      </View>
    </Screen>
  );
}
