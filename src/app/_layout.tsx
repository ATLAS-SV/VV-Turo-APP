import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStoreProvider, useStore } from '../state/AppStore';
import { Logo } from '../ui/Brand';
import { colors, Toasts } from '../ui/components';
import { LogoTransitionProvider } from '../ui/LogoTransition';
import { ExpandProvider } from '../ui/motion';
import { CarriageMorphProvider } from '../ui/CarriageMorph';
import { isGlass } from '../ui/bubble';
import GlassBackdrop from '../ui/GlassBackdrop';
import LogoGradient from '../ui/LogoGradient';
import { LOGO } from '../ui/logoColors';
import { GlassBar } from '../ui/GlassBar';
import { applyAppearance, isLightLook, type Appearance } from '../ui/theme';

/** Pages opened by a box expanding into them fade in under it instead of sliding. */
const EXPANDED_PAGE = { animation: 'fade' as const, animationDuration: 180 };

/** Headers and the tab bar follow the current palette (light, or the logo's purple in dark). */
function navTheme(a: Appearance) {
  const base = isLightLook(a) ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, notification: colors.danger },
  };
}

const glassHeader = () => <GlassBar edge="top" />;

function RootStack() {
  const { loaded, currentUser } = useStore();
  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, backgroundColor: LOGO.to }}>
        <LogoGradient />
        <Logo size={96} light />
        <ActivityIndicator color={LOGO.gold} />
      </View>
    );
  }
  const signedIn = !!currentUser;
  const isExec = currentUser?.role === 'executive';
  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
          ...(isGlass() ? { headerBackground: glassHeader } : {}),
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="car/[id]" options={{ title: 'Car', ...EXPANDED_PAGE }} />
          <Stack.Screen name="booking/[id]" options={{ title: 'Booking', ...EXPANDED_PAGE }} />
          <Stack.Screen name="tasks" options={{ title: 'Tasks', ...EXPANDED_PAGE }} />
          <Stack.Screen name="appearance" options={{ title: 'Appearance', ...EXPANDED_PAGE }} />
          <Stack.Protected guard={isExec}>
            <Stack.Screen name="activity" options={{ title: 'Activity log', ...EXPANDED_PAGE }} />
            <Stack.Screen name="settings" options={{ title: 'Settings', ...EXPANDED_PAGE }} />
            <Stack.Screen name="team" options={{ title: 'Team & PINs', ...EXPANDED_PAGE }} />
            <Stack.Screen name="fleet" options={{ title: 'Cars', ...EXPANDED_PAGE }} />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {signedIn ? <Toasts /> : null}
      <StatusBar style={isLightLook() ? 'dark' : 'light'} />
    </>
  );
}

/**
 * Applies this phone's chosen appearance. Switching redraws the app in the new colors
 * (everything below is rebuilt) and brings you back to the Appearance page.
 */
function AppearanceGate({ children }: { children: ReactNode }) {
  const { appearance } = useStore();
  applyAppearance(appearance); // before anything below renders, so it draws in the right colors
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => router.push('/appearance'), 120);
    return () => clearTimeout(t);
  }, [appearance]);
  return (
    <ThemeProvider key={appearance} value={navTheme(appearance)}>
      <View style={{ flex: 1 }}>
        {appearance === 'glass' || appearance === 'glassLight' ? <GlassBackdrop light={appearance === 'glassLight'} /> : null}
        {children}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <AppearanceGate>
          <ExpandProvider>
            <CarriageMorphProvider>
              <LogoTransitionProvider>
                <RootStack />
              </LogoTransitionProvider>
            </CarriageMorphProvider>
          </ExpandProvider>
        </AppearanceGate>
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
