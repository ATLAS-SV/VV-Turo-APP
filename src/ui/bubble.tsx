// Bubbly motion (every appearance) + the glass surface look (Glass Light / Glass Dark only).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { getAppearance, isLightLook } from './theme';

// ---------- Reduce Motion (known ahead of time so animations can start instantly) ----------

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => (reduceMotion = v));

/** True when the phone's Reduce Motion setting is on. */
export const prefersReducedMotion = () => reduceMotion;

export const isGlass = () => getAppearance() === 'glass' || getAppearance() === 'glassLight';
const nativeDriver = Platform.OS !== 'web';

// ---------- glass surfaces ----------

/** Corner radius: rounder, bubblier corners in Glass. */
export const radius = () => (isGlass() ? 22 : 14);

/** Frosted-glass effect for a surface (blur behind it, soft glow, bright top edge). Empty unless Glass. */
export function glassFx(): ViewStyle {
  if (!isGlass()) return {};
  const light = isLightLook();
  if (Platform.OS === 'web') {
    return {
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      boxShadow: light
        ? '0 10px 30px rgba(70,40,150,0.14), inset 0 1px 0 rgba(255,255,255,0.9)'
        : '0 10px 30px rgba(8,0,40,0.35), inset 0 1px 0 rgba(255,255,255,0.22)',
    } as ViewStyle;
  }
  return { shadowColor: light ? '#4B2C93' : '#000', shadowOpacity: light ? 0.14 : 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } };
}

// ---------- bubbly motion ----------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that squishes down and springs back like a bubble (all appearances; off with Reduce Motion). */
export function Bouncy({ style, children, onPressIn, onPressOut, ...rest }: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const bouncy = !reduceMotion;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        if (bouncy) Animated.spring(scale, { toValue: 0.94, speed: 40, bounciness: 0, useNativeDriver: nativeDriver }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        if (bouncy) Animated.spring(scale, { toValue: 1, speed: 12, bounciness: 16, useNativeDriver: nativeDriver }).start();
        onPressOut?.(e);
      }}
      style={[style, bouncy ? { transform: [{ scale }] } : { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * A row that leaves smoothly: when `leaving` turns on it lifts a touch, then shrinks and fades while
 * the space it took glides closed, and only then calls onGone (e.g. to mark the task done, which
 * removes the row). Scale/fade run on the native driver; the gap closing is a separate, eased value.
 */
export function PopAway({ leaving, onGone, children, style }: { leaving: boolean; onGone: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [pop] = useState(() => new Animated.Value(0)); // 0 resting · 1 lifted · 2 gone (scale + fade)
  const [size] = useState(() => new Animated.Value(1)); // 1 full height · 0 collapsed
  const [h, setH] = useState<number | null>(null);
  const gone = useRef(onGone);
  useEffect(() => {
    gone.current = onGone;
  });
  useEffect(() => {
    if (!leaving) {
      pop.setValue(0);
      size.setValue(1);
      return;
    }
    if (reduceMotion) {
      gone.current();
      return;
    }
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(pop, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(pop, { toValue: 2, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativeDriver }),
      ]),
      Animated.timing(size, { toValue: 0, duration: 300, delay: 170, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]);
    anim.start(({ finished }) => finished && gone.current());
    return () => anim.stop();
  }, [leaving, pop, size]);
  return (
    <Animated.View
      onLayout={(e) => {
        if (!leaving) setH(e.nativeEvent.layout.height);
      }}
      style={[style, leaving && h != null ? { height: size.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), overflow: 'hidden' as const } : null]}
    >
      <Animated.View
        style={{
          opacity: pop.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.015, 0.92], extrapolate: 'clamp' }) }],
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** Content that pops in like a bubble when it first appears (all appearances). `delay` staggers a group. */
export function PopIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [animate] = useState(() => !reduceMotion);
  const [v] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (animate) Animated.spring(v, { toValue: 1, delay, speed: 8, bounciness: 13, useNativeDriver: nativeDriver }).start();
  }, [animate, delay, v]);
  if (!animate) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
