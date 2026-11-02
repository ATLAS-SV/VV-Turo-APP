import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { lockedUntil } from '../logic/pin';
import { useNow, useStore } from '../state/AppStore';
import { Button, colors, Screen } from '../ui/components';
import { PinPad } from '../ui/PinPad';

/** App opens here. The PIN decides who you are and whether you're Executive or Employee. */
export default function SignIn() {
  const { users, signIn, pinLockout } = useStore();
  const now = useNow(1000);
  const [error, setError] = useState<string | null>(null);

  if (!users.length) return <FirstRunSetup />;

  const until = lockedUntil(pinLockout, now);
  const secs = until ? Math.ceil((until.getTime() - now.getTime()) / 1000) : 0;

  return (
    <Screen padTop scroll={false}>
      <View style={styles.center}>
        <Ionicons name="car-sport" size={44} color={colors.primary} />
        <Text style={styles.h1}>Fleet Control</Text>
        <Text style={styles.sub}>Enter your PIN</Text>
        <PinPad
          disabled={!!until}
          error={until ? `Too many wrong PINs. Try again in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : error}
          onSubmit={async (pin) => {
            const r = await signIn(pin);
            setError(r.ok ? null : r.error);
          }}
        />
      </View>
    </Screen>
  );
}

function FirstRunSetup() {
  const { createFirstExecutive } = useStore();
  const [name, setName] = useState('Sebastian');
  const [step, setStep] = useState<'name' | 'pin' | 'confirm'>('name');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop scroll={false}>
        <View style={styles.center}>
          <Ionicons name="key" size={40} color={colors.primary} />
          <Text style={styles.h1}>Set up Fleet Control</Text>
          {step === 'name' ? (
            <View style={{ width: '100%', maxWidth: 340, gap: 12 }}>
              <Text style={styles.sub}>You’ll be the Executive. You can add employees later.</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Your name" style={styles.input} autoFocus />
              <Button label="Next" onPress={() => setStep('pin')} disabled={!name.trim()} />
            </View>
          ) : step === 'pin' ? (
            <>
              <Text style={styles.sub}>Choose your personal PIN (4–8 digits)</Text>
              <PinPad
                submitLabel="Next"
                error={error}
                onSubmit={(p) => {
                  setPin(p);
                  setError(null);
                  setStep('confirm');
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.sub}>Enter the PIN again to confirm</Text>
              <PinPad
                submitLabel="Confirm"
                error={error}
                onSubmit={async (p) => {
                  if (p !== pin) {
                    setError('PINs didn’t match. Start again.');
                    setStep('pin');
                    return;
                  }
                  const r = await createFirstExecutive(name, p);
                  if (!r.ok) {
                    setError(r.error);
                    setStep('pin');
                  }
                }}
              />
            </>
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, fontSize: 16, marginBottom: 12, textAlign: 'center' },
  input: { backgroundColor: colors.card, borderRadius: 10, padding: 14, fontSize: 17, borderWidth: 1, borderColor: colors.border },
});
