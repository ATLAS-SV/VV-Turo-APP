import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStoreProvider, useStore } from '../state/AppStore';
import { colors, Toasts } from '../ui/components';
import { BRAND, Logo } from '../ui/Brand';

function RootStack() {
  const { loaded, currentUser } = useStore();
  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, backgroundColor: BRAND.dark }}>
        <Logo size={96} light />
        <ActivityIndicator color={BRAND.accent} />
      </View>
    );
  }
  const signedIn = !!currentUser;
  const isExec = currentUser?.role === 'executive';
  return (
    <>
      <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="car/[id]" options={{ title: 'Car' }} />
          <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
          <Stack.Screen name="tasks" options={{ title: 'Tasks' }} />
          <Stack.Protected guard={isExec}>
            <Stack.Screen name="activity" options={{ title: 'Activity log' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="team" options={{ title: 'Team & PINs' }} />
            <Stack.Screen name="fleet" options={{ title: 'Cars' }} />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {signedIn ? <Toasts /> : null}
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <RootStack />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
