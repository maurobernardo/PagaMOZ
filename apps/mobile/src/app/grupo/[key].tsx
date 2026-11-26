import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandMark } from "../../components/brand";
import { Alert, Eyebrow, Header, Loading, PageTitle } from "../../components/ui";
import { useServices } from "../../lib/catalog";
import { t } from "../../lib/i18n";
import { C, F, R, shadow } from "../../theme";
import { ListChecks } from "lucide-react-native";

/** Passo 1: escolher a operadora, o fornecedor ou o tipo de contador. */
export default function Grupo() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, error } = useServices();
  const options = (data ?? []).filter((s) => s.group?.key === key);
  const g = options[0]?.group;

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header />
      {error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : !data ? <Loading /> : !g ? (
        <View style={{ padding: 16 }}><Alert>{t("Nada encontrado. Experimente outra palavra.")}</Alert></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 48 }}>
          <Eyebrow icon={ListChecks}>{t("Passo 1 de 2")}</Eyebrow>
          <PageTitle title={g.title} sub={`${g.prompt}.`} />
          <View style={{ height: 4 }} />
          {options.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.group?.option} onPress={() => router.push(`/servico/${s.id}`)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 84, backgroundColor: C.surface, borderRadius: R.card, padding: 16, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
              <BrandMark slug={s.institution.slug} name={s.group?.option ?? s.institution.name} size={54} round />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{s.group?.option}</Text>
                <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }} numberOfLines={1}>{s.institution.name === s.group?.option ? s.name : s.institution.name}</Text>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={20} color={C.white} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
