import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import { PinPad } from './PinPad';

/** Unlocking always asks for the signed-in person's PIN. */
export function UnlockPrompt({ carId, onClose }: { carId: string | null; onClose: () => void }) {
  const { cars, unlockCar } = useStore();
  const [error, setError] = useState<string | null>(null);
  const car = cars.find((c) => c.id === carId);

  const close = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal visible={!!carId} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Unlock {carName(car)}?</Text>
          <Text style={styles.sub}>Enter your PIN to unlock.</Text>
          <PinPad
            submitLabel="Unlock"
            error={error}
            onSubmit={async (pin) => {
              if (!carId) return;
              const r = await unlockCar(carId, pin);
              if (r.ok) close();
              else setError(r.error);
            }}
          />
          <Pressable onPress={close} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 6, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { color: colors.muted, marginBottom: 10 },
  cancel: { padding: 12, marginTop: 4 },
  cancelText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
