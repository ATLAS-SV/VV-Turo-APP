import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Image, Platform, Text, useWindowDimensions, View, type HostInstance, type ViewStyle } from 'react-native';
import { measure, useLogoTransition } from './logoTransitionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppearance, isLightLook, theme } from './theme';

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
      <Text style={{ fontSize: 12, letterSpacing: 2, color: isLightLook() ? BRAND.dark : BRAND.accent, fontWeight: '600' }}>VALADON VENTURES</Text>
    </View>
  );
}

/** Colors for the PIN screen, one per look: Dark keeps the logo look (gold on deep purple), Light is purple on lavender, the Glass looks go frosted. */
export interface PinScreenLook {
  glass: boolean;
  lightText: boolean;
  bg: string;
  frame: string;
  panel: string;
  mono: string;
  sub: string;
  demoBg: string;
  demoText: string;
  keyBg: string;
  keyBorder: string;
  keyText: string;
  keyPressed: string;
  icon: string;
  okReadyBg: string;
  okReadyFg: string;
  dotRing: string;
  dotFill: string;
  error: string;
}

const LOGO_LOOK: PinScreenLook = {
  glass: false,
  lightText: true,
  bg: theme.primaryDark,
  frame: theme.accent,
  panel: 'transparent',
  mono: theme.accent,
  sub: '#E9DFC4',
  demoBg: 'rgba(212,175,55,0.16)',
  demoText: '#F7EED5',
  keyBg: 'rgba(255,255,255,0.04)',
  keyBorder: 'rgba(212,175,55,0.55)',
  keyText: '#F7EED5',
  keyPressed: 'rgba(212,175,55,0.22)',
  icon: theme.accent,
  okReadyBg: theme.accent,
  okReadyFg: theme.primaryDark,
  dotRing: 'rgba(212,175,55,0.6)',
  dotFill: theme.accent,
  error: '#FFB8B8',
};

/** Light: the logo screen in the app's light colors (purple on soft lavender, white keys). */
const LIGHT_LOOK: PinScreenLook = {
  glass: false,
  lightText: false,
  bg: theme.background,
  frame: theme.primary,
  panel: '#FFFFFF',
  mono: theme.primary,
  sub: '#4A4F5C',
  demoBg: 'rgba(59,31,122,0.07)',
  demoText: '#2D2160',
  keyBg: '#F6F4FA',
  keyBorder: '#DDD5EE',
  keyText: '#14171F',
  keyPressed: '#E6DEF7',
  icon: theme.primary,
  okReadyBg: theme.primary,
  okReadyFg: '#FFFFFF',
  dotRing: 'rgba(59,31,122,0.4)',
  dotFill: theme.primary,
  error: '#B91C1C',
};

const GLASS_DARK_LOOK: PinScreenLook = {
  glass: true,
  lightText: true,
  bg: 'transparent', // the glass gradient shows through
  frame: 'rgba(244,207,94,0.75)',
  panel: 'rgba(255,255,255,0.06)',
  mono: '#F4CF5E',
  sub: '#E6DCFA',
  demoBg: 'rgba(255,255,255,0.12)',
  demoText: '#FBF8FF',
  keyBg: 'rgba(255,255,255,0.12)',
  keyBorder: 'rgba(255,255,255,0.35)',
  keyText: '#FBF8FF',
  keyPressed: 'rgba(255,255,255,0.3)',
  icon: '#F4CF5E',
  okReadyBg: '#F4CF5E',
  okReadyFg: '#24104F',
  dotRing: 'rgba(255,255,255,0.6)',
  dotFill: '#F4CF5E',
  error: '#FFB8B8',
};

const GLASS_LIGHT_LOOK: PinScreenLook = {
  glass: true,
  lightText: false,
  bg: 'transparent',
  frame: 'rgba(59,31,122,0.4)',
  panel: 'rgba(255,255,255,0.32)',
  mono: theme.primary,
  sub: '#4A3F75',
  demoBg: 'rgba(59,31,122,0.08)',
  demoText: '#2D2160',
  keyBg: 'rgba(255,255,255,0.6)',
  keyBorder: 'rgba(255,255,255,0.95)',
  keyText: '#1D1340',
  keyPressed: 'rgba(255,255,255,0.95)',
  icon: theme.primary,
  okReadyBg: theme.primary,
  okReadyFg: '#FFFFFF',
  dotRing: 'rgba(59,31,122,0.45)',
  dotFill: theme.primary,
  error: '#B42323',
};

export function pinScreenLook(): PinScreenLook {
  const a = getAppearance();
  return a === 'glass' ? GLASS_DARK_LOOK : a === 'glassLight' ? GLASS_LIGHT_LOOK : a === 'light' ? LIGHT_LOOK : LOGO_LOOK;
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

  const look = pinScreenLook();
  return (
    <View style={{ flex: 1, backgroundColor: look.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
      <View
        ref={frameRef}
        onLayout={report}
        style={[
          look.glass ? frostedPanel(look.lightText) : null,
          {
          flex: 1,
          borderWidth: look.glass ? 1.5 : 2,
          borderColor: look.frame,
          backgroundColor: look.panel,
          borderRadius: 34,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: short ? 10 : 20,
          gap: short ? 2 : 6,
          },
        ]}
      >
        <Text
          ref={vvRef}
          onLayout={report}
          accessibilityRole="header"
          accessibilityLabel="Valadon Ventures"
          style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: vvFontSize(short), lineHeight: vvFontSize(short) * VV_LINE, color: look.mono, letterSpacing: -2 }}
        >
          VV
        </Text>
        <View ref={nameRef} onLayout={report} style={{ alignItems: 'center' }}>
          <CompanyName short={short} color={look.mono} />
        </View>
        {children}
      </View>
    </View>
  );
}

export const VV_LINE = 1.1;
export const vvFontSize = (short: boolean) => (short ? 56 : 84);

/** "VALADON VENTURES" with the short gold rule under it (PIN screen and its transition). */
export function CompanyName({ short, color = BRAND.accent }: { short: boolean; color?: string }) {
  return (
    <>
      <Text style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: short ? 12 : 15, letterSpacing: short ? 4 : 5, color }}>VALADON VENTURES</Text>
      <View style={{ width: 64, height: 1.5, backgroundColor: color, opacity: 0.7, marginTop: short ? 2 : 6, marginBottom: short ? 4 : 14 }} />
    </>
  );
}

/** Frosted-glass panel behind the PIN screen's frame (blur on web, soft shadow on phones). */
function frostedPanel(dark: boolean): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      boxShadow: dark ? '0 20px 50px rgba(8,0,40,0.35), inset 0 1px 0 rgba(255,255,255,0.18)' : '0 20px 50px rgba(70,40,150,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
    } as ViewStyle;
  }
  return { shadowColor: dark ? '#000' : '#4B2C93', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } };
}
