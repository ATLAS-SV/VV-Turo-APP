import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View, useWindowDimensions, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isGlass, prefersReducedMotion } from './bubble';
import { colors } from './components';
import { LOGO } from './logoColors';
import { getAppearance, isLightLook, theme } from './theme';

/**
 * Tap a carriage in the Cars tab and it rides up and grows into the big carriage at the top of the
 * car page: same card, its window strip widens into the info windows, the plate grows. The page opens
 * underneath; once it's drawn it reports where its carriage sits (land) and the moving copy settles
 * exactly there, then fades to reveal the real one.
 */

type Rect = { x: number; y: number; w: number; h: number };
type Label = { title: string; subtitle: string };
type Morph = {
  /** fly(carriageRef.current, { title, subtitle }, () => router.push(...)) */
  fly: (from: HostInstance | null, label: Label, go: () => void) => void;
  /** The car page calls this with its carriage once it's laid out. */
  land: (to: HostInstance | null) => void;
};

const Ctx = createContext<Morph>({ fly: (_f, _l, go) => go(), land: () => {} });
export const useCarriageMorph = () => useContext(Ctx);

/** Sizes of the big carriage on the car page, shared so the moving copy ends up matching it. */
export const BIG_CARRIAGE = { pad: 14, windowTop: 14, windowH: 46, windowGap: 7, plateTop: 72, plateSize: 30 };
/** Sizes of a carriage in the Cars tab list (CarsList). */
const SMALL_CARRIAGE = { padLeft: 34, windowTop: 7, windowH: 5, windowGap: 5, plateTop: 17, plateSize: 19 };

const STRIP = 6; // windows in a list carriage
const BIG_WINDOWS = 4; // info windows on the car page

export function CarriageMorphProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [run, setRun] = useState<{ from: Rect; to: Rect; label: Label } | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [cover] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const s = useRef({ busy: false, flown: false, landed: false, done: false, timer: null as ReturnType<typeof setTimeout> | null });

  const finish = useCallback(() => {
    const st = s.current;
    if (!st.busy || st.done || !st.flown || !st.landed) return;
    st.done = true;
    Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => {
      setRun(null);
      st.busy = false;
    });
  }, [fade]);

  const fly = useCallback<Morph['fly']>(
    (from, label, go) => {
      const st = s.current;
      if (!from || prefersReducedMotion() || st.busy) return go();
      st.busy = true;
      st.flown = false;
      st.landed = false;
      st.done = false;
      from.measureInWindow((x, y, w, h) => {
        if (!w || !h) {
          st.busy = false;
          return go();
        }
        progress.setValue(0);
        cover.setValue(0);
        fade.setValue(1);
        // Best guess at where the page's carriage will be; the page corrects it as soon as it's drawn.
        const guess = { x: 16, y: insets.top + 72, w: width - 32, h: 150 };
        setRun({ from: { x, y, w, h }, to: guess, label });
        Animated.timing(cover, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
        Animated.spring(progress, { toValue: 1, speed: 7, bounciness: 6, useNativeDriver: false, restDisplacementThreshold: 0.005 }).start(() => {
          st.flown = true;
          finish();
        });
        setTimeout(go, 90);
        // If the page never reports in (e.g. car not found), don't hang around.
        st.timer = setTimeout(() => {
          st.landed = true;
          finish();
        }, 1000);
      });
    },
    [progress, cover, fade, insets.top, width, finish],
  );

  const land = useCallback<Morph['land']>(
    (to) => {
      const st = s.current;
      if (!st.busy || st.landed || !to) return;
      to.measureInWindow((x, y, w, h) => {
        if (w && h) setRun((r) => (r ? { ...r, to: { x, y, w, h } } : r));
        st.landed = true;
        if (st.timer) clearTimeout(st.timer);
        finish();
      });
    },
    [finish],
  );

  const value = useMemo(() => ({ fly, land }), [fly, land]);
  const lerp = (a: number, b: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const glass = isGlass();
  const light = isLightLook();
  const card = glass ? (light ? 'rgba(255,255,255,0.96)' : 'rgba(42,24,86,0.97)') : colors.card;
  const backdrop = glass ? (light ? 'rgba(246,241,255,0.9)' : 'rgba(36,16,90,0.85)') : colors.bg;

  let overlay: ReactNode = null;
  if (run) {
    const { from: f, to: t, label } = run;
    const padL = lerp(SMALL_CARRIAGE.padLeft, BIG_CARRIAGE.pad);
    overlay = (
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1100, elevation: 1100, opacity: fade }}>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: backdrop, opacity: cover }}>
          {/* Light: the car page's purple band, so it's already there when the page shows through. */}
          {getAppearance() === 'light' ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: t.y - 16, height: 110, backgroundColor: theme.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }} />
          ) : null}
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            left: lerp(f.x, t.x),
            top: lerp(f.y, t.y),
            width: lerp(f.w, t.w),
            height: lerp(f.h, t.h),
            backgroundColor: card,
            borderTopLeftRadius: lerp(18, 20),
            borderTopRightRadius: lerp(18, 20),
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            shadowColor: '#1E0E45',
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          {/* The window strip: six thin windows widen into four info windows. */}
          <Animated.View style={{ position: 'absolute', top: lerp(SMALL_CARRIAGE.windowTop, BIG_CARRIAGE.windowTop), left: lerp(14, BIG_CARRIAGE.pad), right: lerp(14, BIG_CARRIAGE.pad), flexDirection: 'row' }}>
            {Array.from({ length: STRIP }).map((_, i) => {
              const extra = i >= BIG_WINDOWS;
              return (
                <Animated.View
                  key={i}
                  style={{
                    flex: extra ? lerp(1, 0.0001) : 1,
                    marginLeft: i === 0 ? 0 : extra ? lerp(SMALL_CARRIAGE.windowGap, 0) : lerp(SMALL_CARRIAGE.windowGap, BIG_CARRIAGE.windowGap),
                    opacity: extra ? lerp(1, 0) : 1,
                    height: lerp(SMALL_CARRIAGE.windowH, BIG_CARRIAGE.windowH),
                    borderRadius: lerp(3, 10),
                    borderWidth: lerp(0, 1.5),
                    borderColor: LOGO.gold,
                    backgroundColor: colors.neutralBg,
                  }}
                />
              );
            })}
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: padL, right: lerp(66, 110), top: lerp(SMALL_CARRIAGE.plateTop, BIG_CARRIAGE.plateTop) }}>
            <Animated.Text numberOfLines={1} style={{ fontSize: lerp(SMALL_CARRIAGE.plateSize, BIG_CARRIAGE.plateSize), fontWeight: '800', letterSpacing: lerp(1.2, 2), color: colors.text }}>
              {label.title}
            </Animated.Text>
            <Animated.Text numberOfLines={1} style={{ fontSize: lerp(12, 14), fontWeight: '500', color: colors.muted, marginTop: 2 }}>
              {label.subtitle}
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {overlay}
      </View>
    </Ctx.Provider>
  );
}
