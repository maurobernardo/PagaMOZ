import { Tabs } from "expo-router";
import { House, LayoutGrid, ShieldCheck, User, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F } from "../../theme";

/** Ícone do separador: o activo fica numa pílula preta. */
const icon = (I: LucideIcon) => ({ focused }: { focused: boolean }) => (
  <View style={{ width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: focused ? C.ink : "transparent" }}>
    <I size={20} color={focused ? C.white : "#8d8c87"} />
  </View>
);

export default function TabsLayout() {
  const bottom = useSafeAreaInsets().bottom;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: "#8d8c87",
        tabBarLabelStyle: { fontFamily: F.bold, fontSize: 11, marginTop: 2 },
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line, height: 70 + bottom, paddingTop: 8, paddingBottom: bottom + 8 },
        sceneStyle: { backgroundColor: C.canvas },
      }}>
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: icon(House) }} />
      <Tabs.Screen name="servicos" options={{ title: "Serviços", tabBarIcon: icon(LayoutGrid) }} />
      <Tabs.Screen name="verificar" options={{ title: "Verificar", tabBarIcon: icon(ShieldCheck) }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: icon(User) }} />
    </Tabs>
  );
}
