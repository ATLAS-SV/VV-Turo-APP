// Bubbly motion (every appearance) + the glass surface look (Glass Light / Glass Dark only).
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
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
