import { Image, Text, View } from 'react-native';
import { theme } from './theme';

export const BRAND = {
  company: 'Valadon Ventures',
  appName: 'VV inc.',
  dark: theme.primaryDark,
  accent: theme.accent,
};

const mark = require('../../assets/logo-mark.png');

export function LogoMark({ size = 32 }: { size?: number }) {
  return <Image source={mark} style={{ width: size, height: size, borderRadius: size * 0.22 }} accessibilityLabel={`${BRAND.company} logo`} />;
}

/** Full logo: VV badge with the company name under it. */
export function Logo({ size = 88, light = false }: { size?: number; light?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <LogoMark size={size} />
      <Text
        style={{
          fontSize: Math.max(14, size * 0.22),
          fontWeight: '700',
          letterSpacing: 3,
          color: light ? '#FFFFFF' : BRAND.dark,
          fontFamily: 'serif',
        }}
      >
        VALADON VENTURES
      </Text>
      <View style={{ width: size * 0.6, height: 2, backgroundColor: BRAND.accent, borderRadius: 1 }} />
    </View>
  );
}

/** Small badge shown at the left of screen headers. */
export function HeaderMark() {
  return (
    <View style={{ marginLeft: 16 }}>
      <LogoMark size={28} />
    </View>
  );
}

/** Footer line for the bottom of screens. */
export function BrandFooter() {
  return (
    <View style={{ alignItems: 'center', gap: 6, marginTop: 24, opacity: 0.8 }}>
      <LogoMark size={24} />
      <Text style={{ fontSize: 12, letterSpacing: 2, color: BRAND.dark, fontWeight: '600' }}>VALADON VENTURES</Text>
    </View>
  );
}
