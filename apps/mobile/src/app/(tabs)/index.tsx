import { router } from "expo-router";
import { ArrowRight, BadgeCheck, Search, ShieldCheck, Sparkles, Wallet, Zap } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryIcon, Logo } from "../../components/brand";
import { EntryCard } from "../../components/service-card";
import { Button, Eyebrow, Field, H1, H2, P } from "../../components/ui";
import { groupServices, useCategories, useServices } from "../../lib/catalog";
import { C, F, R } from "../../theme";

const POPULAR = ["energia", "recarga", "tv"];

export default function Home() {
  const top = useSafeAreaInsets().top;
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const cats = useCategories();
  const { data, refreshing, refresh } = useServices();
  const popular = groupServices(data ?? []).filter((e) => e.kind === "group" && POPULAR.includes(e.key));

  const track = () => {
    const c = code.toUpperCase().replace(/[\s-]/g, "");
    if (/^PMZ[0-9A-Z]{10}$/.test(c)) router.push(`/pagamento/${c}`);
    else setCodeErr("Escreva o código do pagamento (começa por PMZ).");
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />} keyboardShouldPersistTaps="handled">
      <Logo />

      <View style={{ backgroundColor: C.ink, borderRadius: 32, padding: 22, gap: 16 }}>
        <Eyebrow dark icon={Sparkles}>Pagamentos em Moçambique</Eyebrow>
        <H1 light>Pague serviços sem ir ao balcão.</H1>
        <P light>Luz, água, recargas, impostos, multas, documentos. O dinheiro vai direito para a instituição.</P>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: R.pill, padding: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}>
          <Search size={20} color="rgba(255,255,255,0.6)" style={{ marginLeft: 10 }} />
          <TextInput value={q} onChangeText={setQ} placeholder="O que quer pagar?" placeholderTextColor="rgba(255,255,255,0.45)" returnKeyType="search" accessibilityLabel="Pesquisar serviço"
            onSubmitEditing={() => router.push({ pathname: "/servicos", params: { q } })}
            style={{ flex: 1, minHeight: 46, color: C.white, fontFamily: F.semi, fontSize: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Pesquisar" onPress={() => router.push({ pathname: "/servicos", params: { q } })}
            style={{ backgroundColor: C.white, borderRadius: R.pill, width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={20} color={C.ink} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[[BadgeCheck, "Comprovativo com QR"], [Wallet, "M-Pesa, e-Mola, cartão"]].map(([I, t]) => {
            const Icon = I as typeof Zap;
            return (
              <View key={String(t)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 10 }}>
                <Icon size={16} color={C.white} />
                <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{String(t)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 14 }}>
        <H2>O que quer pagar?</H2>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {cats.map((c) => {
            const I = categoryIcon(c.slug);
            return (
              <Pressable key={c.slug} accessibilityRole="button" onPress={() => router.push({ pathname: "/servicos", params: { categoria: c.slug } })}
                style={({ pressed }) => ({ width: "48%", flexGrow: 1, backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: pressed ? C.ink : C.line, padding: 16, gap: 12 })}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                  <I size={24} color={C.white} />
                </View>
                <Text style={{ fontFamily: F.display, fontSize: 16, lineHeight: 20, color: C.ink }}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {popular.length ? (
        <View style={{ gap: 12 }}>
          <H2>Mais usados</H2>
          {popular.map((e) => <EntryCard key={e.kind === "group" ? e.key : e.s.id} e={e} />)}
        </View>
      ) : null}

      <View style={{ backgroundColor: C.white, borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: 20, gap: 14 }}>
        <Eyebrow icon={ShieldCheck}>Acompanhar</Eyebrow>
        <H2>Já pagou? Veja o estado.</H2>
        <Field label="Código do pagamento" value={code} onChangeText={(v) => { setCode(v); setCodeErr(""); }} placeholder="PMZ…" autoCapitalize="characters" error={codeErr} mono />
        <Button onPress={track} icon={ArrowRight}>Ver estado</Button>
      </View>
    </ScrollView>
  );
}
