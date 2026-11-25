import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { C, F } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

export default function Root() {
  const [loaded, error] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: C.canvas },
          headerTitleStyle: { fontFamily: F.bold, fontSize: 16, color: C.ink },
          headerTintColor: C.ink,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: C.canvas },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="grupo/[key]" options={{ title: "" }} />
        <Stack.Screen name="servico/[id]" options={{ title: "" }} />
        <Stack.Screen name="pagamento/[ref]" options={{ title: "Pagamento" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
