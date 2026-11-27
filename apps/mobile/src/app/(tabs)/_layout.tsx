import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { FloatingTabBar } from "../../components/floating-tabs";
import { Platform } from "react-native";
import { t } from "../../lib/i18n";
import { C, F } from "../../theme";

/**
 * Barra de separadores do próprio sistema: Liquid Glass no iOS 26, Material 3 no Android.
 * O activo fica a preto (ou branco no modo escuro).
 */
export default function TabsLayout() {
  // Android: a barra do sistema ocupa a largura toda e cola ao fundo; aqui usa-se uma pílula flutuante como no iOS.
  if (Platform.OS === "android")
    return (
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="servicos" />
        <Tabs.Screen name="verificar" />
        <Tabs.Screen name="conta" />
      </Tabs>
    );
  return (
    // Android: nomes sempre visíveis (por omissão o Material esconde-os) e sem fonte própria, que o Android não aplicava.
    <NativeTabs
      tintColor={C.ink}
      labelVisibilityMode="labeled"
      backgroundColor={C.surface}
      iconColor={{ default: C.muted, selected: C.ink }}
      labelStyle={{
        default: { fontSize: 12, color: C.muted, ...(Platform.OS === "ios" ? { fontFamily: F.bold } : {}) },
        selected: { fontSize: 12, color: C.ink, ...(Platform.OS === "ios" ? { fontFamily: F.bold } : {}) },
      }}
      indicatorColor={C.soft}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>{t("Início")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="servicos">
        <NativeTabs.Trigger.Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} md="grid_view" />
        <NativeTabs.Trigger.Label>{t("Serviços")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="verificar">
        <NativeTabs.Trigger.Icon sf={{ default: "checkmark.shield", selected: "checkmark.shield.fill" }} md="verified_user" />
        <NativeTabs.Trigger.Label>{t("Verificar")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="conta">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
        <NativeTabs.Trigger.Label>{t("Definições")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
