import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { prefersReducedMotion } from './bubble';

// Drawing units (scaled by `scale`). The rail sits RAIL_Y units down from the top.
const H = 16;
export const RAIL_Y = 13;
const CAR_LEN = 22;
/** Room kept in front of the parked car for its headlight beam. */
const AHEAD = 16;

const ring = (cx: number, cy: number, r: number, hole: number) =>
  `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z` +
  `M${cx - hole},${cy}a${hole},${hole} 0 1,0 ${2 * hole},0a${hole},${hole} 0 1,0 ${-2 * hole},0Z`;

/**
 * Train tracks running out of the right side of the logo (the logo is the tunnel exit), with a car
 * speeding along the rails instead of a train. Place it with its left edge against the logo: the car
 * starts hidden "inside" the logo and drives out to the right once, then stays parked.
 * One color, faint. No motion with Reduce Motion.
 */
export function TrackRun({
  width,
  color,
  scale = 1,
  opacity = 0.38,
  delay = 400,
}: {
  width: number;
  color: string;
  scale?: number;
  opacity?: number;
  delay?: number;
}) {
  const motion = !prefersReducedMotion();
  const [drive] = useState(() => new Animated.Value(motion ? 0 : 1));
  useEffect(() => {
    if (!motion) return;
    Animated.timing(drive, { toValue: 1, duration: 1400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [drive, motion, delay]);

  if (width < 60 * scale) return null;
  const w = width / scale; // width in drawing units
  const height = H * scale;
  const x0 = w - CAR_LEN - AHEAD; // where the car parks (its rear)

  const sleepers = [];
  for (let x = 2; x < w - 4; x += 7) {
    sleepers.push(<Rect key={x} x={x} y={RAIL_Y + 0.8} width={3.4} height={2.2} rx={0.5} fill={color} opacity={1 - 0.8 * (x / w)} />);
  }

  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height, opacity, overflow: 'hidden' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${w} ${H}`} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={`vvRail${Math.round(w)}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0.15" />
          </LinearGradient>
        </Defs>
        {/* the tunnel mouth's shadow right where the tracks leave the logo */}
        <Path d={`M0,${RAIL_Y} V3.5 Q4,3.5 4,8 V${RAIL_Y} Z`} fill={color} opacity={0.35} />
        <Path d={`M0,${RAIL_Y} H${w}`} stroke={`url(#vvRail${Math.round(w)})`} strokeWidth={1.3} />
        {sleepers}
      </Svg>

      {/* The car drives out of the logo to the right, then parks. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          transform: [{ translateX: drive.interpolate({ inputRange: [0, 1], outputRange: [-(x0 + CAR_LEN + AHEAD) * scale, 0] }) }],
        }}
      >
        <Svg width={width} height={height} viewBox={`0 0 ${w} ${H}`}>
          {/* speed lines behind the car */}
          <Path d={`M${x0 - 3},4.6 H${x0 - 12} M${x0 - 2},7.6 H${x0 - 17} M${x0 - 3},10.4 H${x0 - 10}`} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
          {/* body, window cut out; nose on the right */}
          <Path
            fillRule="evenodd"
            d={
              `M${x0},10.5 L${x0},7.2 L${x0 + 4},6.6 L${x0 + 8},3 L${x0 + 15},3 L${x0 + 18.5},6.3 L${x0 + 22},7 L${x0 + 22},10.5 Z ` +
              `M${x0 + 8.6},6.4 L${x0 + 10.6},4.1 L${x0 + 14.4},4.1 L${x0 + 16.6},6.4 Z`
            }
            fill={color}
          />
          {/* wheels on the rail */}
          <Path fillRule="evenodd" d={ring(x0 + 5.5, 10.6, 2.4, 0.9) + ring(x0 + 16.8, 10.6, 2.4, 0.9)} fill={color} />
          {/* headlight beam */}
          <Path d={`M${x0 + 22},7.6 L${x0 + 34},5.6 L${x0 + 34},10.2 Z`} fill={color} opacity={0.22} />
        </Svg>
      </Animated.View>
    </View>
  );
}
