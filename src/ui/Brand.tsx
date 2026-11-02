import type { ReactNode } from 'react';
import { Image, Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** Serif matching the logo's "VV" lettering. */
const LOGO_SERIF = Platform.select({ ios: 'Times New Roman', android: 'serif', default: '"Times New Roman", Times, serif' });

/**
 * The logo, expanded to the whole screen: deep purple field with the logo's thin gold frame
 * running around the edge, and the gold VV monogram + company name at the top.
 */
export function LogoScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const short = useWindowDimensions().height < 740; // e.g. iPhone SE: scale the monogram down
  return (
    <View style={{ flex: 1, backgroundColor: BRAND.dark, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
      <View
        style={{
          flex: 1,
          borderWidth: 2,
          borderColor: BRAND.accent,
          borderRadius: 34,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: short ? 10 : 20,
          gap: short ? 2 : 6,
        }}
      >
        <Text
          accessibilityRole="header"
          accessibilityLabel="Valadon Ventures"
          style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: short ? 56 : 84, lineHeight: short ? 62 : 92, color: BRAND.accent, letterSpacing: -2 }}
        >
          VV
        </Text>
        <Text style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: short ? 12 : 15, letterSpacing: short ? 4 : 5, color: BRAND.accent }}>VALADON VENTURES</Text>
        <View style={{ width: 64, height: 1.5, backgroundColor: BRAND.accent, opacity: 0.7, marginTop: short ? 2 : 6, marginBottom: short ? 4 : 14 }} />
        {children}
      </View>
    </View>
  );
}
