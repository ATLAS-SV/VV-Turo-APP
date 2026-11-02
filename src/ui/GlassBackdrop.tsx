// Glass appearance background for native app builds: deep purple with a few soft glowing circles.
// (The web/home-screen version, GlassBackdrop.web.tsx, adds the gradient and floating bubbles.)
import { View } from 'react-native';

export default function GlassBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#1E0E45', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, left: -100, top: 40, backgroundColor: 'rgba(139,92,246,0.35)' }} />
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -90, top: '40%', backgroundColor: 'rgba(212,175,55,0.18)' }} />
      <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, left: '15%', bottom: -140, backgroundColor: 'rgba(109,63,224,0.3)' }} />
    </View>
  );
}
