// Sign-in → app: the full-screen logo (PIN screen) shrinks into the small VV logo in the header.
//  1. A copy of the logo is laid exactly over the PIN screen while the keypad fades away.
//  2. The app opens underneath (still covered).
//  3. The purple field, gold frame and "VV" shrink together into the header logo; the company name fades.
//  4. The copy fades into the real header logo.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, useWindowDimensions, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompanyName, HEADER_MARK_SIZE, LOGO_SERIF, VV_LINE, vvFontSize } from './Brand';
import { LogoTransitionCtx, measure, type LogoTransitionApi, type Rect } from './logoTransitionContext';
import { prefersReducedMotion } from './motion';
import { theme } from './theme';

const COVER_MS = 160;
const SHRINK_MS = 620;
const BLEND_MS = 180;

type Source = { frame?: Rect; vv?: Rect; name?: Rect };

export function LogoTransitionProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const source = useRef<Source>({});
  const targets = useRef(new Set<HostInstance>());
  const [run, setRun] = useState<{ src: Required<Source>; short: boolean; target: Rect | null } | null>(null);
  const [cover] = useState(() => new Animated.Value(0));
  const [p] = useState(() => new Animated.Value(0));
  const [blend] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => Animated.multiply(cover, blend));

  /** Find the visible header logo once the app has rendered (it may take a few frames). */
  const findTarget = useCallback(async (): Promise<Rect> => {
    for (let i = 0; i < 20; i++) {
      for (const node of targets.current) {
        const r = await measure(node);
        if (r && r.x < 120 && r.y >= 0) return r;
      }
      await new Promise((res) => setTimeout(res, 40));
    }
    return { x: 16, y: insets.top + 8, w: HEADER_MARK_SIZE, h: HEADER_MARK_SIZE }; // where the header logo normally sits
  }, [insets.top]);

  const api = useMemo<LogoTransitionApi>(
    () => ({
      setSource(parts) {
        source.current = { ...source.current, ...parts };
      },
      addTarget(node) {
        if (!node) return () => {};
        targets.current.add(node);
        return () => targets.current.delete(node);
      },
      begin(switchToApp) {
        const s = source.current;
        if (prefersReducedMotion() || !s.frame || !s.vv || !s.name) return switchToApp();
        cover.setValue(0);
        p.setValue(0);
        blend.setValue(1);
        setRun({ src: { frame: s.frame, vv: s.vv, name: s.name }, short: s.vv.h < vvFontSize(false), target: null });
        Animated.timing(cover, { toValue: 1, duration: COVER_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(async () => {
          switchToApp();
          const target = await findTarget();
          setRun((r) => (r ? { ...r, target } : r));
          Animated.timing(p, { toValue: 1, duration: SHRINK_MS, easing: Easing.bezier(0.65, 0, 0.25, 1), useNativeDriver: false }).start(() => {
            Animated.timing(blend, { toValue: 0, duration: BLEND_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => setRun(null));
          });
        });
      },
    }),
    [cover, p, blend, findTarget],
  );

  let overlay: ReactNode = null;
  if (run) {
    const { src, short } = run;
    // Until the header logo is found, "target" is the starting position, so nothing moves yet.
    const t = run.target ?? { x: 0, y: 0, w: width, h: height };
    const lerp = (a: number, b: number) => p.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
    const ring = { x: t.x + t.w * 0.16, y: t.y + t.h * 0.16, w: t.w * 0.68, h: t.h * 0.68 };
    const fs0 = vvFontSize(short);
    const fs1 = t.w * 0.42;
    const vvCx = src.vv.x + src.vv.w / 2;
    const vvCy = src.vv.y + src.vv.h / 2;
    const fontSize = run.target ? lerp(fs0, fs1) : fs0;
    const box = run.target ? { left: lerp(0, t.x), top: lerp(0, t.y), width: lerp(width, t.w), height: lerp(height, t.h), borderRadius: lerp(0, t.w * 0.22) } : { left: 0, top: 0, width, height, borderRadius: 0 };
    const frame = run.target
      ? { left: lerp(src.frame.x, ring.x), top: lerp(src.frame.y, ring.y), width: lerp(src.frame.w, ring.w), height: lerp(src.frame.h, ring.h), borderRadius: lerp(34, t.w * 0.12), borderWidth: lerp(2, 0.8) }
      : { left: src.frame.x, top: src.frame.y, width: src.frame.w, height: src.frame.h, borderRadius: 34, borderWidth: 2 };
    const cx = run.target ? lerp(vvCx, t.x + t.w / 2) : vvCx;
    const cy = run.target ? lerp(vvCy, t.y + t.h / 2) : vvCy;
    const TEXT_W = 400;

    overlay = (
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 2000, elevation: 2000, opacity }}>
        <Animated.View style={{ position: 'absolute', backgroundColor: theme.primaryDark, ...box }} />
        <Animated.View style={{ position: 'absolute', borderColor: theme.accent, ...frame }} />
        <Animated.View
          style={{
            position: 'absolute',
            left: src.name.x,
            top: src.name.y,
            width: src.name.w,
            alignItems: 'center',
            opacity: p.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' }),
            transform: [{ translateY: p.interpolate({ inputRange: [0, 0.3], outputRange: [0, -10], extrapolate: 'clamp' }) }],
          }}
        >
          <CompanyName short={short} />
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            width: TEXT_W,
            left: Animated.subtract(cx, TEXT_W / 2),
            top: Animated.subtract(cy, Animated.multiply(fontSize, VV_LINE / 2)),
          }}
        >
          <Animated.Text
            style={{
              textAlign: 'center',
              fontFamily: LOGO_SERIF,
              fontWeight: '700',
              color: theme.accent,
              fontSize,
              lineHeight: Animated.multiply(fontSize, VV_LINE),
              letterSpacing: run.target ? lerp(-2, -0.3) : -2,
            }}
          >
            VV
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <LogoTransitionCtx.Provider value={api}>
      <View style={{ flex: 1 }}>
        {children}
        {overlay}
      </View>
    </LogoTransitionCtx.Provider>
  );
}
