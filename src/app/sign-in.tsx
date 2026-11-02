import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { lockedUntil, validatePinFormat } from '../logic/pin';
import { DEMO_MODE, DEMO_PINS, useNow, useStore } from '../state/AppStore';
import { colors, Screen } from '../ui/components';
import { PinPad } from '../ui/PinPad';
import { Logo } from '../ui/Brand';

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
        <Logo size={84} />
        <Text style={[styles.sub, { marginTop: 18 }]}>Enter your PIN</Text>
        {DEMO_MODE ? (
          <Text style={styles.demo}>
            Demo · Executive PIN {DEMO_PINS.executive} · Employee PIN {DEMO_PINS.employee}
          </Text>
        ) : null}
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

/** Very first launch only: same PIN pad, used to create the Executive PIN. */
function FirstRunSetup() {
  const { createFirstExecutive } = useStore();
  const [step, setStep] = useState<'pin' | 'confirm'>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen padTop scroll={false}>
      <View style={styles.center}>
        <Logo size={84} />
        <Text style={[styles.sub, { marginTop: 18 }]}>
          {step === 'pin' ? 'Create your Executive PIN (4–8 digits)' : 'Enter the same PIN again'}
        </Text>
        <PinPad
          key={step}
          submitLabel={step === 'pin' ? 'Next' : 'Confirm'}
          error={error}
          onSubmit={async (p) => {
            if (step === 'pin') {
              const err = validatePinFormat(p);
              if (err) return setError(err);
              setPin(p);
              setError(null);
              setStep('confirm');
              return;
            }
            if (p !== pin) {
              setError('PINs didn’t match. Start again.');
              setStep('pin');
              return;
            }
            const r = await createFirstExecutive('Sebastian', p);
            if (!r.ok) {
              setError(r.error);
              setStep('pin');
            }
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, fontSize: 16, marginBottom: 12, textAlign: 'center' },
  demo: { color: colors.primary, backgroundColor: colors.neutralBg, fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: -6, marginBottom: 6, textAlign: 'center' },
});
