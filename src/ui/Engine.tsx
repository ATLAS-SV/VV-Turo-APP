import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { isGlass } from './bubble';
import { colors } from './components';
import LogoGradient from './LogoGradient';
import { LOGO } from './logoColors';

/**
 * The lead engine of a train: a body in the logo's gradient with a cab (two gold windows) on top,
 * sitting on a short stretch of track. The Cars tab and the Tasks page put their summary in it.
 */
export function Engine({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ paddingBottom: 12, marginTop: 12 }, style]}>
      {/* cab */}
      <View
        style={{
          position: 'absolute',
          top: -13,
          right: 22,
          width: 96,
          height: 26,
          borderTopLeftRadius: 13,
          borderTopRightRadius: 13,
          overflow: 'hidden',
          flexDirection: 'row',
          gap: 7,
          paddingHorizontal: 13,
          paddingTop: 6,
          backgroundColor: LOGO.to,
        }}
      >
        <LogoGradient />
        <View style={{ flex: 1, height: 9, borderRadius: 3, backgroundColor: LOGO.gold }} />
        <View style={{ flex: 1, height: 9, borderRadius: 3, backgroundColor: LOGO.gold }} />
      </View>
      <View
        style={[
          {
            borderTopLeftRadius: 26,
            borderTopRightRadius: 18,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            overflow: 'hidden',
            padding: 16,
            gap: 12,
            backgroundColor: LOGO.to,
          },
          isGlass() ? {} : { shadowColor: '#1E0E45', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
        ]}
      >
        <LogoGradient />
        {children}
      </View>
      <Track />
    </View>
  );
}

/** A short stretch of track: a rail with crossties under it (under the engine and every carriage). */
export function Track() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -6, right: -6, bottom: 0, height: 8 }}>
      <View style={{ height: 2, borderRadius: 1, backgroundColor: colors.secondary }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, marginTop: 1 }}>
        {Array.from({ length: 26 }).map((_, i) => (
          <View key={i} style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: colors.secondary, opacity: 0.35 }} />
        ))}
      </View>
    </View>
  );
}
