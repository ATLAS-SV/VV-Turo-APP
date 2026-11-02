import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PIN_LENGTH } from '../logic/pin';
import { pinScreenLook } from './Brand';
import { glassFx, PopIn, prefersReducedMotion } from './bubble';
import { colors } from './components';

const nativeDriver = Platform.OS !== 'web';

/** Colors for one pad. 'brand' = the PIN screen (matches the look); 'light' = sheets inside the app (follows the palette). */
function padColors(variant: 'light' | 'brand') {
  if (variant === 'brand') {
    const l = pinScreenLook();
    return {
      glass: l.glass,
      keyBg: l.keyBg,
      keyBorder: l.keyBorder,
      keyBorderWidth: 1.5,
      keyText: l.keyText,
      keyWeight: '400' as const,
      keyPressed: l.keyPressed,
      icon: l.icon,
      okIdleBg: 'transparent',
      okIdleFg: l.icon,
      okReadyBg: l.okReadyBg,
      okReadyFg: l.okReadyFg,
      dotRing: l.dotRing,
      dotFill: l.dotFill,
      ripple: l.dotFill,
      error: l.error,
    };
  }
  return {
    glass: false,
    keyBg: colors.card,
    keyBorder: colors.border,
    keyBorderWidth: StyleSheet.hairlineWidth,
    keyText: colors.text,
    keyWeight: '500' as const,
    keyPressed: colors.neutralBg,
    icon: colors.text,
    okIdleBg: colors.neutralBg,
    okIdleFg: colors.muted,
    okReadyBg: colors.primary,
    okReadyFg: colors.primaryText,
    dotRing: colors.muted,
    dotFill: colors.text,
    ripple: colors.primary,
    error: colors.danger,
  };
}

/** Number pad with dots. The 4th digit (or the check key) calls onSubmit. Keys pop in and squish like bubbles. */
export function PinPad({
  onSubmit,
  disabled,
  error,
  submitLabel = 'Enter',
  variant = 'light',
}: {
  onSubmit: (pin: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  error?: string | null;
  submitLabel?: string;
  /** 'brand' = the PIN screen: gold on purple, or frosted glass in the Glass looks. */
  variant?: 'light' | 'brand';
}) {
  const c = padColors(variant);
  // Smaller keys on short screens (e.g. iPhone SE) so the whole pad fits.
  const { height } = useWindowDimensions();
  const keySize = height < 740 ? 62 : 76;
  const gap = height < 740 ? 14 : 18;
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Wrong PIN: the dots shake side to side.
  const [shakeX] = useState(() => new Animated.Value(0));
  const shook = useRef(0);
  useEffect(() => {
    if (attempt === shook.current) return;
    shook.current = attempt;
    if (!error || prefersReducedMotion()) return;
    const step = (to: number) => Animated.timing(shakeX, { toValue: to, duration: 45, useNativeDriver: nativeDriver });
    Animated.sequence([step(-14), step(14), step(-10), step(10), step(-5), step(0)]).start();
  }, [attempt, error, shakeX]);

  const submit = async (value: string) => {
    setBusy(true);
    const keep = await onSubmit(value);
    setBusy(false);
    if (!keep) setPin('');
    setAttempt((a) => a + 1);
  };

  const press = async (key: string) => {
    if (disabled || busy) return;
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    if (key === 'ok') {
      if (pin.length === PIN_LENGTH) await submit(pin);
      return;
    }
    if (pin.length >= PIN_LENGTH) return; // PINs are exactly 4 digits: ignore extra presses
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) await submit(next); // the 4th digit submits, like an iPhone passcode
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  const okReady = pin.length === PIN_LENGTH;
  return (
    <View style={{ alignItems: 'center', gap: height < 740 ? 10 : 18 }}>
      <Animated.View style={{ flexDirection: 'row', gap: 14, minHeight: 18, transform: [{ translateX: shakeX }] }} accessibilityLabel={`${pin.length} digits entered`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <Dot key={i} filled={i < pin.length} ring={c.dotRing} fill={c.dotFill} />
        ))}
      </Animated.View>
      <Text style={{ color: c.error, fontSize: 14, minHeight: 18, textAlign: 'center' }}>{error ?? ' '}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 3 * keySize + 2 * gap, gap }}>
        {keys.map((k, i) => {
          const isOk = k === 'ok';
          return (
            <PinKey
              key={k}
              size={keySize}
              delay={i * 35}
              label={k === 'del' ? 'Delete' : isOk ? submitLabel : k}
              disabled={disabled || busy}
              onPress={() => press(k)}
              bg={isOk ? (okReady ? c.okReadyBg : c.okIdleBg) : c.keyBg}
              border={isOk && okReady ? c.okReadyBg : c.keyBorder}
              borderWidth={c.keyBorderWidth}
              pressedBg={isOk && okReady ? c.okReadyBg : c.keyPressed}
              ripple={c.ripple}
              glass={c.glass}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={c.icon} />
              ) : isOk ? (
                <Ionicons name="checkmark" size={28} color={okReady ? c.okReadyFg : c.okIdleFg} />
              ) : (
                <Text style={{ fontSize: 28, fontWeight: c.keyWeight, color: c.keyText }}>{k}</Text>
              )}
            </PinKey>
          );
        })}
      </View>
    </View>
  );
}

/**
 * One round key, bubble-style: pops in, squishes down hard when pressed, springs back with a wobble,
 * and a ring ripples out from it like a bubble bursting.
 */
function PinKey({
  size,
  delay,
  label,
  disabled,
  onPress,
  bg,
  border,
  borderWidth,
  pressedBg,
  ripple,
  glass,
  children,
}: {
  size: number;
  delay: number;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  bg: string;
  border: string;
  borderWidth: number;
  pressedBg: string;
  ripple: string;
  glass: boolean;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const [ring] = useState(() => new Animated.Value(0));
  const motion = !prefersReducedMotion();

  const down = () => {
    setPressed(true);
    if (!motion) return;
    Animated.spring(scale, { toValue: 0.82, speed: 50, bounciness: 0, useNativeDriver: nativeDriver }).start();
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
  };
  const up = () => {
    setPressed(false);
    if (motion) Animated.spring(scale, { toValue: 1, speed: 14, bounciness: 20, useNativeDriver: nativeDriver }).start();
  };

  return (
    <PopIn delay={delay}>
      <View style={{ width: size, height: size }}>
        {motion ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: ripple,
              opacity: ring.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.7, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.55] }) }],
            }}
          />
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} onPressIn={down} onPressOut={up}>
          <Animated.View
            style={[
              { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? pressedBg : bg, borderWidth, borderColor: border },
              glass ? glassFx() : null,
              disabled ? { opacity: 0.4 } : null,
              { transform: [{ scale }] },
            ]}
          >
            {children}
          </Animated.View>
        </Pressable>
      </View>
    </PopIn>
  );
}

/** A PIN dot: the fill pops in with a little overshoot when a digit is typed and shrinks away when deleted. */
function Dot({ filled, ring, fill }: { filled: boolean; ring: string; fill: string }) {
  const [v] = useState(() => new Animated.Value(filled ? 1 : 0));
  useEffect(() => {
    if (prefersReducedMotion()) v.setValue(filled ? 1 : 0);
    else if (filled) Animated.spring(v, { toValue: 1, speed: 18, bounciness: 22, useNativeDriver: nativeDriver }).start();
    else Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: nativeDriver }).start();
  }, [filled, v]);
  return (
    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: filled ? fill : ring, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: fill, transform: [{ scale: v }] }} />
    </View>
  );
}
