import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../logic/pin';
import { colors } from './components';

/** Number pad with dots. Calls onSubmit when the check key is pressed. */
export function PinPad({
  onSubmit,
  disabled,
  error,
  submitLabel = 'Enter',
}: {
  onSubmit: (pin: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  error?: string | null;
  submitLabel?: string;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const press = async (key: string) => {
    if (disabled || busy) return;
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    if (key === 'ok') {
      if (pin.length < PIN_MIN_LENGTH) return;
      setBusy(true);
      const keep = await onSubmit(pin);
      setBusy(false);
      if (!keep) setPin('');
      return;
    }
    setPin((p) => (p.length < PIN_MAX_LENGTH ? p + key : p));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <View style={{ alignItems: 'center', gap: 18 }}>
      <View style={styles.dots} accessibilityLabel={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(PIN_MIN_LENGTH, pin.length) }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
        ))}
      </View>
      <Text style={styles.error}>{error ?? ' '}</Text>
      <View style={styles.grid}>
        {keys.map((k) => {
          const isOk = k === 'ok';
          const okReady = pin.length >= PIN_MIN_LENGTH;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete' : isOk ? submitLabel : k}
              onPress={() => press(k)}
              disabled={disabled || busy}
              style={({ pressed }) => [
                styles.key,
                isOk && { backgroundColor: okReady ? colors.primary : colors.neutralBg },
                pressed && { opacity: 0.6 },
                disabled && { opacity: 0.4 },
              ]}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.text} />
              ) : isOk ? (
                <Ionicons name="checkmark" size={28} color={okReady ? '#fff' : colors.muted} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 14, minHeight: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.muted },
  dotFilled: { backgroundColor: colors.text, borderColor: colors.text },
  error: { color: colors.danger, fontSize: 14, minHeight: 18, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 76 + 2 * 18, gap: 18, justifyContent: 'center' },
  key: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  keyText: { fontSize: 28, fontWeight: '500', color: colors.text },
});
