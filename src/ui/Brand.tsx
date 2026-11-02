import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Image, Platform, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { measure, useLogoTransition } from './logoTransitionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppearance, theme } from './theme';

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
  // Reports itself as the spot the sign-in logo shrinks into.
  const ref = useRef<HostInstance>(null);
  const { addTarget } = useLogoTransition();
  useEffect(() => addTarget(ref.current), [addTarget]);
  return (
    <View style={{ marginLeft: 16 }}>
      <View ref={ref} style={{ width: HEADER_MARK_SIZE, height: HEADER_MARK_SIZE }}>
        <LogoMark size={HEADER_MARK_SIZE} />
      </View>
    </View>
  );
}

export const HEADER_MARK_SIZE = 28;

/** Footer line for the bottom of screens. */
export function BrandFooter() {
  return (
    <View style={{ alignItems: 'center', gap: 6, marginTop: 24, opacity: 0.8 }}>
      <LogoMark size={24} />
      <Text style={{ fontSize: 12, letterSpacing: 2, color: getAppearance() === 'dark' ? BRAND.accent : BRAND.dark, fontWeight: '600' }}>VALADON VENTURES</Text>
    </View>
  );
}

/** Serif matching the logo's "VV" lettering. */
export const LOGO_SERIF = Platform.select({ ios: 'Times New Roman', android: 'serif', default: '"Times New Roman", Times, serif' });

/**
 * The logo, expanded to the whole screen: deep purple field with the logo's thin gold frame
 * running around the edge, and the gold VV monogram + company name at the top.
 */
export function LogoScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const short = useWindowDimensions().height < 740; // e.g. iPhone SE: scale the monogram down

  // Tell the sign-in transition where the big logo pieces are, so it can shrink them from there.
  const { setSource } = useLogoTransition();
  const frameRef = useRef<HostInstance>(null);
  const vvRef = useRef<HostInstance>(null);
  const nameRef = useRef<HostInstance>(null);
  const report = useCallback(async () => {
    const [frame, vv, name] = await Promise.all([measure(frameRef.current), measure(vvRef.current), measure(nameRef.current)]);
    setSource({ frame: frame ?? undefined, vv: vv ?? undefined, name: name ?? undefined });
  }, [setSource]);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.dark, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
      <View
        ref={frameRef}
        onLayout={report}
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
          ref={vvRef}
          onLayout={report}
          accessibilityRole="header"
          accessibilityLabel="Valadon Ventures"
          style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: vvFontSize(short), lineHeight: vvFontSize(short) * VV_LINE, color: BRAND.accent, letterSpacing: -2 }}
        >
          VV
        </Text>
        <View ref={nameRef} onLayout={report} style={{ alignItems: 'center' }}>
          <CompanyName short={short} />
        </View>
        {children}
      </View>
    </View>
  );
}

export const VV_LINE = 1.1;
export const vvFontSize = (short: boolean) => (short ? 56 : 84);

/** "VALADON VENTURES" with the short gold rule under it (PIN screen and its transition). */
export function CompanyName({ short }: { short: boolean }) {
  return (
    <>
      <Text style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: short ? 12 : 15, letterSpacing: short ? 4 : 5, color: BRAND.accent }}>VALADON VENTURES</Text>
      <View style={{ width: 64, height: 1.5, backgroundColor: BRAND.accent, opacity: 0.7, marginTop: short ? 2 : 6, marginBottom: short ? 4 : 14 }} />
    </>
  );
}
