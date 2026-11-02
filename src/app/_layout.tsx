import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStoreProvider, useStore } from "../state/AppStore";
import { colors, Toasts } from "../ui/components";
import { BRAND, Logo } from "../ui/Brand";
import { ExpandProvider } from "../ui/motion";
import { LogoTransitionProvider } from "../ui/LogoTransition";
import { APPEARANCE } from "../ui/theme";

/** Pages opened by a box expanding into them fade in under it instead of sliding. */
const EXPANDED_PAGE = { animation: "fade" as const, animationDuration: 180 };

/** Headers and the tab bar follow the app's palette (light, or the logo's purple in dark). */
const NAV_THEME = {
  ...(APPEARANCE === "dark" ? DarkTheme : DefaultTheme),
  colors: {
    ...(APPEARANCE === "dark" ? DarkTheme : DefaultTheme).colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

function RootStack() {
  const { loaded, currentUser } = useStore();
  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          backgroundColor: BRAND.dark,
        }}
      >
        <Logo size={96} light />
        <ActivityIndicator color={BRAND.accent} />
      </View>
    );
  }
  const signedIn = !!currentUser;
  const isExec = currentUser?.role === "executive";
  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="car/[id]"
            options={{ title: "Car", ...EXPANDED_PAGE }}
          />
          <Stack.Screen
            name="booking/[id]"
            options={{ title: "Booking", ...EXPANDED_PAGE }}
          />
          <Stack.Screen
            name="tasks"
            options={{ title: "Tasks", ...EXPANDED_PAGE }}
          />
          <Stack.Protected guard={isExec}>
            <Stack.Screen
              name="activity"
              options={{ title: "Activity log", ...EXPANDED_PAGE }}
            />
            <Stack.Screen
              name="settings"
              options={{ title: "Settings", ...EXPANDED_PAGE }}
            />
            <Stack.Screen
              name="team"
              options={{ title: "Team & PINs", ...EXPANDED_PAGE }}
            />
            <Stack.Screen
              name="fleet"
              options={{ title: "Cars", ...EXPANDED_PAGE }}
            />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {signedIn ? <Toasts /> : null}
      <StatusBar style={APPEARANCE === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={NAV_THEME}>
      <SafeAreaProvider>
        <AppStoreProvider>
          <ExpandProvider>
            <LogoTransitionProvider>
              <RootStack />
            </LogoTransitionProvider>
          </ExpandProvider>
        </AppStoreProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
