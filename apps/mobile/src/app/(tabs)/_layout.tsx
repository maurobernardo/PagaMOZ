import { NativeTabs } from "expo-router/native-tabs";
import { t } from "../../lib/i18n";
import { C, F } from "../../theme";

/**
 * Barra de separadores do próprio sistema: Liquid Glass no iOS 26, Material 3 no Android.
 * O activo fica a preto (ou branco no modo escuro).
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={C.ink} labelStyle={{ fontFamily: F.bold, fontSize: 11, color: C.muted }} backgroundColor={C.surface}>
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
