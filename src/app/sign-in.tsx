import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { lockedUntil, validatePinFormat } from '../logic/pin';
import { DEMO_MODE, DEMO_PINS, useNow, useStore } from '../state/AppStore';
import { PinPad } from '../ui/PinPad';
import { LogoScreen } from '../ui/Brand';
import { useLogoTransition } from '../ui/logoTransitionContext';

/** App opens here. The PIN decides who you are and whether you're Executive or Employee. */
export default function SignIn() {
  const { users, signIn, pinLockout } = useStore();
  const logo = useLogoTransition();
  const now = useNow(1000);
  const [error, setError] = useState<string | null>(null);

  if (!users.length) return <FirstRunSetup />;

  const until = lockedUntil(pinLockout, now);
  const secs = until ? Math.ceil((until.getTime() - now.getTime()) / 1000) : 0;

  return (
    <LogoScreen>
      <StatusBar style="light" />
      <Text style={styles.sub}>Enter your PIN</Text>
      {DEMO_MODE ? (
        <Text style={styles.demo}>
          Demo · Executive PIN {DEMO_PINS.executive} · Employee PIN {DEMO_PINS.employee}
        </Text>
      ) : null}
      <PinPad
        variant="brand"
        disabled={!!until}
        error={until ? `Too many wrong PINs. Try again in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : error}
        onSubmit={async (pin) => {
          const r = await signIn(pin, logo.begin);
          setError(r.ok ? null : r.error);
        }}
      />
    </LogoScreen>
  );
}

/** Very first launch only: same PIN pad, used to create the Executive PIN. */
function FirstRunSetup() {
  const { createFirstExecutive } = useStore();
  const logo = useLogoTransition();
  const [step, setStep] = useState<'pin' | 'confirm'>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <LogoScreen>
      <StatusBar style="light" />
      <Text style={styles.sub}>
        {step === 'pin' ? 'Create your Executive PIN (4–8 digits)' : 'Enter the same PIN again'}
      </Text>
      <PinPad
        variant="brand"
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
          const r = await createFirstExecutive('Sebastian', p, logo.begin);
          if (!r.ok) {
            setError(r.error);
            setStep('pin');
          }
        }}
      />
    </LogoScreen>
  );
}

const styles = StyleSheet.create({
  sub: { color: '#E9DFC4', fontSize: 16, marginBottom: 6, textAlign: 'center', letterSpacing: 0.3 },
  demo: { color: '#F7EED5', backgroundColor: 'rgba(212,175,55,0.16)', fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 4, textAlign: 'center' },
});
