import { router, useLocalSearchParams } from "expo-router";
import { LayoutGrid, Search, SearchX } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryIcon } from "../../components/brand";
import { EntryCard } from "../../components/service-card";
import { Alert, H1, Loading, P } from "../../components/ui";
import { groupServices, useCategories, useServices } from "../../lib/catalog";
import { C, F, R } from "../../theme";

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
  const { data, error, refreshing, refresh } = useServices({ category: cat, q: search });
  const entries = groupServices(data ?? []);
  const current = cats.find((c) => c.slug === cat);

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => (e.kind === "group" ? `g-${e.key}` : `s-${e.s.id}`)}
      renderItem={({ item }) => <EntryCard e={item} />}
      contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 4 }}>
          <H1>{search ? `“${search}”` : current?.name ?? "Serviços"}</H1>
          <P muted>{current?.description ?? "Toque num assunto ou pesquise pelo nome."}</P>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.white, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14 }}>
            <Search size={20} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Serviço ou instituição" placeholderTextColor="#b5b4ae" returnKeyType="search" accessibilityLabel="Pesquisar"
              onSubmitEditing={() => setSearch(q.trim())} style={{ flex: 1, minHeight: 52, fontFamily: F.semi, fontSize: 16, color: C.ink }} />
            {search ? (
              <Pressable accessibilityRole="button" onPress={() => { setQ(""); setSearch(""); router.setParams({ q: "" }); }}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>Limpar</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Todos" icon={LayoutGrid} active={!cat} onPress={() => setCat("")} />
            {cats.map((c) => <Chip key={c.slug} label={c.name} icon={categoryIcon(c.slug)} active={cat === c.slug} onPress={() => setCat(c.slug)} />)}
          </ScrollView>
          {error ? <Alert>{error}</Alert> : null}
        </View>
      }
      ListEmptyComponent={
        data === null ? <Loading /> : (
          <View style={{ alignItems: "center", gap: 10, padding: 32 }}>
            <SearchX size={32} color={C.muted} />
            <P muted>Nada encontrado. Experimente outra palavra.</P>
          </View>
        )
      }
    />
  );
}

function Chip({ label, icon: Icon, active, onPress }: { label: string; icon: typeof Search; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: active ? C.ink : C.white, borderWidth: 1, borderColor: active ? C.ink : C.line }}>
      <Icon size={16} color={active ? C.white : C.ink} />
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: active ? C.white : C.ink }}>{label}</Text>
    </Pressable>
  );
}
