import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { getItem, ONBOARDED } from "../lib/storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { C, F } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

export default function Root() {
  const [loaded, error] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    getItem(ONBOARDED).then((v) => setSeen(v === "1"));
  }, []);
  const ready = (loaded || !!error) && seen !== null;
  useEffect(() => {
    if (!ready) return;
    if (!seen) router.replace("/bem-vindo"); // primeira vez: boas-vindas
    SplashScreen.hideAsync().catch(() => {});
  }, [ready, seen]);
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
        <Stack.Screen name="bem-vindo" options={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="grupo/[key]" options={{ title: "" }} />
        <Stack.Screen name="servico/[id]" options={{ title: "" }} />
        <Stack.Screen name="pagamento/[ref]" options={{ title: "Pagamento" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
