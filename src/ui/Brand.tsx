import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { measure, useLogoTransition } from './logoTransitionContext';
import LogoGradient from './LogoGradient';
import { LOGO } from './logoColors';
import { RAIL_Y, TrackRun } from './TrackRun';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLightLook, theme } from './theme';

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
  const { width } = useWindowDimensions();
  return (
    <View style={{ marginLeft: 16 }}>
      {/* Tracks run out of the logo's right side along the bottom of the bar, with a car speeding on them. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: HEADER_MARK_SIZE - 1, top: HEADER_MARK_SIZE + 0.5 - RAIL_Y }}>
        <TrackRun width={Math.min(width, 700) - 16 - HEADER_MARK_SIZE - 14} color={isLightLook() ? theme.primary : theme.accent} opacity={0.32} delay={900} />
      </View>
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

/** Colors for the PIN screen: always the logo (gold on the logo gradient), whatever the app's appearance. */
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
  bg: LOGO.to, // under the logo gradient
  frame: LOGO.gold,
  panel: 'transparent',
  mono: LOGO.gold,
  sub: '#EFE6FF',
  demoBg: 'rgba(255,255,255,0.12)',
  demoText: '#FFF7E0',
  keyBg: 'rgba(255,255,255,0.08)',
  keyBorder: 'rgba(244,207,94,0.6)',
  keyText: '#FFF7E6',
  keyPressed: 'rgba(244,207,94,0.28)',
  icon: LOGO.gold,
  okReadyBg: LOGO.gold,
  okReadyFg: LOGO.to,
  dotRing: 'rgba(244,207,94,0.65)',
  dotFill: LOGO.gold,
  error: '#FFC4C4',
};

export function pinScreenLook(): PinScreenLook {
  // Same in every appearance: the PIN screen is the logo, so it shrinks smoothly into the header logo.
  return LOGO_LOOK;
}

/** Serif matching the logo's "VV" lettering. */
export const LOGO_SERIF = Platform.select({ ios: 'Times New Roman', android: 'serif', default: '"Times New Roman", Times, serif' });

/**
 * The logo, expanded to the whole screen: deep purple field with the logo's thin gold frame
 * running around the edge, and the gold VV monogram + company name at the top.
 */
export function LogoScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const short = win.height < 740; // e.g. iPhone SE: scale the monogram down
  // Tracks run out of the right side of the big VV (the logo is the tunnel exit) with a car on them.
  const [vvW, setVvW] = useState(0);
  const trackScale = short ? 1.2 : 1.7;
  const vvSize = vvFontSize(short);
  const baseline = (vvSize * VV_LINE - vvSize * 1.107) / 2 + vvSize * 0.891; // Times-style serif metrics
  const tuck = vvSize * 0.28; // start under the right V's arm, next to its point
  const trackW = vvW ? (win.width - 60 - vvW) / 2 + 6 + tuck : 0;

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
      <LogoGradient />
      <View
        ref={frameRef}
        onLayout={report}
        style={[
          {
          flex: 1,
          borderWidth: 2,
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
        <View>
        <Text
          ref={vvRef}
          onLayout={(e) => {
            setVvW(e.nativeEvent.layout.width);
            report();
          }}
          accessibilityRole="header"
          accessibilityLabel="Valadon Ventures"
          style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: vvFontSize(short), lineHeight: vvFontSize(short) * VV_LINE, color: look.mono, letterSpacing: -2 }}
        >
          VV
        </Text>
          {trackW > 0 ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: vvW - tuck, top: baseline - RAIL_Y * trackScale }}>
              <TrackRun width={trackW} scale={trackScale} color={look.mono} opacity={look.lightText ? 0.5 : 0.42} delay={500} />
            </View>
          ) : null}
        </View>
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
export function CompanyName({ short, color = LOGO.gold }: { short: boolean; color?: string }) {
  return (
    <>
      <Text style={{ fontFamily: LOGO_SERIF, fontWeight: '700', fontSize: short ? 12 : 15, letterSpacing: short ? 4 : 5, color }}>VALADON VENTURES</Text>
      <View style={{ width: 64, height: 1.5, backgroundColor: color, opacity: 0.7, marginTop: short ? 2 : 6, marginBottom: short ? 4 : 14 }} />
    </>
  );
}

