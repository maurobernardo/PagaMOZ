import { Tabs } from "expo-router";
import { House, LayoutGrid, ShieldCheck, User } from "lucide-react-native";
import { C, F } from "../../theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: "#9b9a95",
        tabBarLabelStyle: { fontFamily: F.bold, fontSize: 11 },
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: C.canvas },
      }}>
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ color }) => <House size={22} color={color} /> }} />
      <Tabs.Screen name="servicos" options={{ title: "Serviços", tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} /> }} />
      <Tabs.Screen name="verificar" options={{ title: "Verificar", tabBarIcon: ({ color }) => <ShieldCheck size={22} color={color} /> }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}
