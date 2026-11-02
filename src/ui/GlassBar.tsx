// Frosted-glass background for the header and the tab bar (Glass appearance).
import { View } from 'react-native';
import { glassFx } from './bubble';
import { colors } from './components';
import { isLightLook } from './theme';

export function GlassBar({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <View
      style={[
        { flex: 1, backgroundColor: isLightLook() ? 'rgba(255,255,255,0.5)' : 'rgba(30,14,69,0.42)' },
        edge === 'top' ? { borderBottomWidth: 1, borderBottomColor: colors.border } : { borderTopWidth: 1, borderTopColor: colors.border },
        glassFx(),
      ]}
    />
  );
}
