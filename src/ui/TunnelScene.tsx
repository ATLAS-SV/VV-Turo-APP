import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { prefersReducedMotion } from './bubble';

// Drawing units. The art is scaled to fit `width`.
const VB_W = 320;
const VB_H = 80;
const RAIL_Y = 66;
/** Left edge of the tunnel mouth: the car is hidden to the right of it (inside the tunnel). */
const MOUTH_X = 256;
/** How far right the car starts (inside the tunnel) before it drives out. */
const START_SHIFT = 112;

const ring = (cx: number, cy: number, r: number, hole: number) =>
  `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z` +
  `M${cx - hole},${cy}a${hole},${hole} 0 1,0 ${2 * hole},0a${hole},${hole} 0 1,0 ${-2 * hole},0Z`;

/**
 * Small one-color line drawing for the top of the PIN screen: a train tunnel on the right with tracks
 * running out of it, and instead of a train, a car speeding along the rails. When the screen opens the
 * car drives out of the tunnel once and settles (no motion with Reduce Motion).
 */
export function TunnelScene({ width, color, opacity = 0.4 }: { width: number; color: string; opacity?: number }) {
  const s = width / VB_W;
  const height = VB_H * s;
  const motion = !prefersReducedMotion();
  const [drive] = useState(() => new Animated.Value(motion ? 0 : 1));

  useEffect(() => {
    if (!motion) return;
    Animated.timing(drive, { toValue: 1, duration: 1300, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [drive, motion]);

  const sleepers = [];
  for (let x = 6; x < 250; x += 13) {
    sleepers.push(<Rect key={x} x={x} y={RAIL_Y + 1.5} width={6} height={3.5} rx={0.8} fill={color} opacity={0.25 + 0.75 * (x / 250)} />);
  }

  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height, opacity }}>
      {/* Scenery: hill, tunnel portal, tracks. */}
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="vvRailFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="294" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="0.35" stopColor={color} stopOpacity="0.7" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d="M237,66 C244,62 245,33 261,22 C277,11 303,12 320,19" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Path d={`M${MOUTH_X},66 V43 A15,15 0 0 1 286,43 V66 Z`} fill={color} opacity={0.28} />
        <Path d="M250,66 V42 A21,21 0 0 1 292,42 V66" stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
        <Path d="M271,21 V27 M256,27 L259,31 M286,27 L283,31" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Path d={`M0,${RAIL_Y} H294`} stroke="url(#vvRailFade)" strokeWidth={2} />
        {sleepers}
      </Svg>

      {/* The car, clipped at the tunnel mouth so it looks like it's coming out of it. */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: MOUTH_X * s, height, overflow: 'hidden' }}>
        <Animated.View
          style={{
            width,
            height,
            transform: [{ translateX: drive.interpolate({ inputRange: [0, 1], outputRange: [START_SHIFT * s, 0] }) }],
          }}
        >
          <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {/* headlight beam */}
            <Path d="M146,53.5 L116,48 L116,60 Z" fill={color} opacity={0.2} />
            {/* body with the window cut out */}
            <Path
              fillRule="evenodd"
              d="M146,58 L148,52.5 L162,50 L172,43 L190,43 L199,50 L203,52 L203,58 Z M167,50 L175,45.2 L188,45.2 L194,50 Z"
              fill={color}
            />
            {/* wheels on the rail */}
            <Path fillRule="evenodd" d={ring(157, 60, 5.2, 1.8) + ring(192, 60, 5.2, 1.8)} fill={color} />
            {/* speed lines */}
            <Path d="M209,46.5 H228 M211,51.5 H236 M208,56 H224" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.65} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}
