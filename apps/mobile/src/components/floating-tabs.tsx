import type { Tabs } from "expo-router";
import { Grid2x2, House, Settings, ShieldCheck, type LucideIcon } from "lucide-react-native";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../lib/i18n";
import { C, F, shadow } from "../theme";

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ITEMS: Record<string, [LucideIcon, string]> = {
  index: [House, "Início"],
  servicos: [Grid2x2, "Serviços"],
  verificar: [ShieldCheck, "Verificar"],
  conta: [Settings, "Definições"],
};

/** Android: barra flutuante em pílula (como a do iOS), afastada das margens e do fundo. */
export function FloatingTabBar({ state, navigateToTab }: BarProps) {
  const bottom = useSafeAreaInsets().bottom;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(bottom, 10) + 6, alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 4, padding: 6, borderRadius: 34, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, ...shadow() }}>
        {state.routes.map((route, i) => {
          const item = ITEMS[route.name];
          if (!item) return null;
          const [Icon, label] = item;
          const active = state.index === i;
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t(label)}
              onPress={() => {
                if (!active) navigateToTab(route.key);
              }}
              style={({ pressed }) => ({
                minWidth: 76, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 28, alignItems: "center", gap: 3,
                backgroundColor: active ? C.soft : "transparent", opacity: pressed ? 0.7 : 1,
              })}>
              <Icon size={21} color={active ? C.ink : C.muted} strokeWidth={active ? 2.4 : 2} />
              <Text numberOfLines={1} style={{ fontFamily: active ? F.bold : F.semi, fontSize: 11, color: active ? C.ink : C.muted }}>{t(label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
