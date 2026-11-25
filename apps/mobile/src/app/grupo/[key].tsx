import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronRight, ListChecks } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandMark } from "../../components/brand";
import { Alert, Eyebrow, H1, Loading, P } from "../../components/ui";
import { useServices } from "../../lib/catalog";
import { C, F, R } from "../../theme";

/** Passo 1: escolher a operadora, o fornecedor ou o tipo de contador. */
export default function Grupo() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, error } = useServices();
  if (error) return <View style={{ padding: 16 }}><Alert>{error}</Alert></View>;
  if (!data) return <Loading />;
  const options = data.filter((s) => s.group?.key === key);
  const g = options[0]?.group;
  if (!g) return <View style={{ padding: 16 }}><Alert>Este assunto já não existe.</Alert></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: g.title }} />
      <View style={{ backgroundColor: C.ink, borderRadius: 32, padding: 22, gap: 12 }}>
        <Eyebrow dark icon={ListChecks}>Passo 1 de 2</Eyebrow>
        <H1 light>{g.title}</H1>
        <P light size={17}>{g.prompt}.</P>
      </View>
      {options.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.group?.option} onPress={() => router.push(`/servico/${s.id}`)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 88, backgroundColor: C.white, borderRadius: R.card, borderWidth: 1.5, borderColor: pressed ? C.ink : C.line, padding: 16 })}>
          <BrandMark slug={s.institution.slug} name={s.group?.option ?? s.institution.name} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink }}>{s.group?.option}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }} numberOfLines={1}>{s.institution.name === s.group?.option ? s.name : s.institution.name}</Text>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={22} color={C.white} />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
