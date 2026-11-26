import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { Fingerprint } from "lucide-react-native";
import { Appearance, Platform, View } from "react-native";
import { LogoMark } from "../components/brand";
import { Button } from "../components/ui";
import { t } from "../lib/i18n";
import { api } from "../lib/api";
import { registerPush } from "../lib/push";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setLang } from "../lib/i18n";
import { loadPrefs, PrefsProvider, resolveDark, savePrefs, type Prefs } from "../lib/prefs";
import { getItem, ONBOARDED } from "../lib/storage";
import { applyScheme, C, isDark } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });
if (Platform.OS !== "web")
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });

function apply(p: Prefs) {
  applyScheme(resolveDark(p.theme));
  setLang(p.lang);
}

export default function Root() {
  const [loaded, error] = useFonts({ Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [seen, setSeen] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0); // muda -> a app redesenha-se com o tema/idioma novos
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    loadPrefs().then((p) => { apply(p); setPrefs(p); });
    getItem(ONBOARDED).then((v) => setSeen(v === "1"));
  }, []);

  // Tema "automático": segue o telemóvel quando este muda de claro para escuro.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      if (prefs?.theme === "system") { apply(prefs); setVersion((v) => v + 1); }
    });
    return () => sub.remove();
  }, [prefs]);

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((old) => {
      const next = { ...(old as Prefs), ...patch };
      savePrefs(next);
      if (patch.theme !== undefined || patch.lang !== undefined) { apply(next); setVersion((v) => v + 1); }
      return next;
    });
  }, []);

  // Push: regista o telemóvel se houver sessão; tocar num aviso abre o pagamento.
  useEffect(() => {
    if (!prefs?.notifyPayments || Platform.OS === "web") return;
    api("/api/me").then(() => registerPush()).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = String(r.notification.request.content.data?.url ?? "");
      const ref = url.match(/pagamento\/(PMZ[0-9A-Z]+)/)?.[1];
      if (ref) router.push(`/pagamento/${ref}`);
      else if (url.endsWith("contas")) router.push("/contas");
    });
    return () => sub.remove();
  }, [prefs?.notifyPayments]);

  const ready = (loaded || !!error) && seen !== null && prefs !== null;
  useEffect(() => {
    if (!ready) return;
    if (!seen) router.replace("/bem-vindo"); // primeira vez: boas-vindas
    SplashScreen.hideAsync().catch(() => {});
  }, [ready, seen]);
  if (!ready || !prefs) return null;

  // Biometria ao abrir (opcional, em Definições).
  const unlock = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: "PagaMOZ" });
    if (r.success) setLocked(false);
  };
  if (prefs.biometric && locked && Platform.OS !== "web")
    return (
      <SafeAreaProvider>
        <PrefsProvider value={{ prefs, set }}>
          <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: "center", justifyContent: "center", gap: 28, padding: 32 }}>
            <LogoMark size={56} />
            <Button icon={Fingerprint} onPress={unlock} style={{ alignSelf: "stretch" }}>{t("Entrar")}</Button>
          </View>
        </PrefsProvider>
      </SafeAreaProvider>
    );

  return (
    <SafeAreaProvider>
      <PrefsProvider value={{ prefs, set }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack key={version} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="bem-vindo" options={{ gestureEnabled: false, animation: "fade" }} />
          <Stack.Screen name="perfil" options={{ presentation: "modal" }} />
        </Stack>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
