import { useLocalSearchParams } from "expo-router";
import { Search, SearchX, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryIcon } from "../../components/brand";
import { EntryCard } from "../../components/service-card";
import { Alert, Loading, P, PageTitle, Pill } from "../../components/ui";
import { groupServices, useCategories, useServices } from "../../lib/catalog";
import { t } from "../../lib/i18n";
import { C, F, R, shadow } from "../../theme";

export default function Servicos() {
  const top = useSafeAreaInsets().top;
  const params = useLocalSearchParams<{ categoria?: string; q?: string }>();
  const [cat, setCat] = useState(params.categoria ?? "");
  const [q, setQ] = useState(params.q ?? "");
  const [search, setSearch] = useState(params.q ?? "");
  useEffect(() => {
    setCat(params.categoria ?? "");
    setQ(params.q ?? "");
    setSearch(params.q ?? "");
  }, [params.categoria, params.q]);

  const cats = useCategories();
  const { data, error, refreshing, refresh, offline } = useServices({ category: cat, q: search });
  const entries = groupServices(data ?? []);
  const current = cats.find((c) => c.slug === cat);

  return (
    <FlatList
      style={{ backgroundColor: C.canvas }}
      data={entries}
      keyExtractor={(e) => (e.kind === "group" ? `g-${e.key}` : `s-${e.s.id}`)}
      renderItem={({ item }) => <EntryCard e={item} />}
      contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 18, paddingBottom: 120, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 6 }}>
          <PageTitle title={search ? `“${search}”` : current?.name ?? t("Serviços")} sub={current?.description ?? t("Toque num assunto ou pesquise pelo nome.")} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 16, ...shadow() }}>
            <Search size={20} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={t("Serviço ou instituição")} placeholderTextColor={C.muted} returnKeyType="search" accessibilityLabel={t("Serviço ou instituição")}
              onSubmitEditing={() => setSearch(q.trim())} style={{ flex: 1, minHeight: 52, fontFamily: F.body, fontSize: 16, color: C.ink }} />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("Limpar")} hitSlop={8} onPress={() => { setQ(""); setSearch(""); }}>
                <X size={18} color={C.muted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 8 }}>
            <Pill label={t("Todos")} active={!cat} onPress={() => setCat("")} />
            {cats.map((c) => <Pill key={c.slug} label={c.name} icon={categoryIcon(c.slug)} active={cat === c.slug} onPress={() => setCat(c.slug)} />)}
          </ScrollView>
          {offline ? <Alert tone="info">{t("Sem internet: a mostrar a última lista guardada. Pagar precisa de rede.")}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}
        </View>
      }
      ListEmptyComponent={
        data === null ? <Loading /> : (
          <View style={{ alignItems: "center", gap: 10, padding: 32 }}>
            <SearchX size={32} color={C.muted} />
            <P muted>{t("Nada encontrado. Experimente outra palavra.")}</P>
          </View>
        )
      }
    />
  );
}
