import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { LOGO } from './logoColors';

/** Fills its parent with the logo gradient (phones: SVG). Bright violet bottom-left → deep purple top-right. */
export default function LogoGradient() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="vvLogoGradient" x1="0.1" y1="1" x2="0.9" y2="0">
            <Stop offset="0" stopColor={LOGO.from} />
            <Stop offset="0.48" stopColor={LOGO.mid} />
            <Stop offset="1" stopColor={LOGO.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#vvLogoGradient)" />
      </Svg>
    </View>
  );
}
