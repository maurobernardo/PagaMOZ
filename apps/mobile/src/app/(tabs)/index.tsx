import { router, useFocusEffect } from "expo-router";
import { ArrowRight, ChevronRight, Search, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark, categoryIcon, LogoMark } from "../../components/brand";
import { api, type Payment, type Service } from "../../lib/api";
import { useCategories, useServices } from "../../lib/catalog";
import { formatMZN, PAYMENT_STATUS } from "../../lib/format";
import { C, F, R } from "../../theme";

function greeting() {
  const h = (new Date().getUTCHours() + 2) % 24; // Maputo
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Atalhos "Pagar rápido": um toque e está no serviço (ou na escolha da operadora). */
const QUICK: { label: string; find: (s: Service) => boolean; group?: string }[] = [
  { label: "Credelec", find: (s) => s.institution.slug === "edm" && s.slug === "credelec" },
  { label: "Água", find: (s) => s.institution.slug === "adrmm" },
  { label: "Recarga", find: (s) => s.group?.key === "recarga", group: "recarga" },
  { label: "TV", find: (s) => s.group?.key === "tv", group: "tv" },
  { label: "Multas", find: (s) => s.institution.slug === "inatter" },
  { label: "Passaporte", find: (s) => s.slug === "passaporte" },
];

export default function Home() {
  const top = useSafeAreaInsets().top;
  const cats = useCategories();
  const { data: services, refreshing, refresh } = useServices();
  const [me, setMe] = useState<{ phone: string } | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");

  const loadMe = useCallback(() => {
    api<{ phone: string }>("/api/me")
      .then(async (m) => {
        setMe(m);
        const r = await api<Payment[] | { results: Payment[] }>("/api/me/payments");
        setPayments(Array.isArray(r) ? r : r.results);
      })
      .catch(() => { setMe(null); setPayments([]); });
  }, []);
  useFocusEffect(loadMe);

  const last = payments[0];
  const paid = payments.filter((p) => ["CONFIRMADA", "LIQUIDADA"].includes(p.status));
  const track = () => {
    const c = code.toUpperCase().replace(/[\s-]/g, "");
    if (/^PMZ[0-9A-Z]{10}$/.test(c)) router.push(`/pagamento/${c}`);
    else setCodeErr("O código começa por PMZ e tem 13 caracteres.");
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: top + 10, paddingHorizontal: 16, paddingBottom: 40, gap: 22 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); loadMe(); }} tintColor={C.ink} />}>
      {/* Cabeçalho */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <LogoMark size={32} />
          <Text style={{ fontFamily: F.displayX, fontSize: 19, letterSpacing: -0.5, color: C.ink }}>pagamoz</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="A minha conta" onPress={() => router.push("/conta")}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
          <User size={20} color={C.ink} />
        </Pressable>
      </View>

      {/* Saudação */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 16, color: C.muted }}>{greeting()},</Text>
        <Text style={{ fontFamily: F.display, fontSize: 34, letterSpacing: -0.9, color: C.ink }}>
          {me ? me.phone.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3") : "O que vamos pagar?"}
        </Text>
      </View>

      <Pressable accessibilityRole="search" onPress={() => router.push("/servicos")}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54, borderRadius: R.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, paddingHorizontal: 18 }}>
        <Search size={20} color={C.muted} />
        <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 15, color: "#9b9a95" }}>Pesquisar serviço ou instituição</Text>
      </Pressable>

      {/* Último pagamento (só com conta) */}
      {last ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/pagamento/${last.reference}`)}
          style={({ pressed }) => ({ backgroundColor: C.white, borderRadius: R.card, borderWidth: 1, borderColor: pressed ? C.ink : C.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 })}>
          <BrandMark slug={last.institution_slug} name={last.institution_name} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.muted }}>Último pagamento</Text>
            <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }} numberOfLines={1}>{last.service_name}</Text>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>{PAYMENT_STATUS[last.status]?.label} · {formatMZN(last.total)}</Text>
          </View>
          <ChevronRight size={20} color={C.ink} />
        </Pressable>
      ) : null}

      {me ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label="Pagamentos" value={String(payments.length)} />
          <Stat label="Total pago" value={formatMZN(paid.reduce((a, p) => a + p.total, 0)).replace(",00", "")} />
        </View>
      ) : null}

      {/* Pagar rápido */}
      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>Pagar rápido</Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>Os pagamentos mais comuns, a um toque.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {QUICK.map((q) => {
            const s = services?.find(q.find);
            if (!s) return null;
            return (
              <Pressable key={q.label} accessibilityRole="button" accessibilityLabel={q.label}
                onPress={() => router.push(q.group ? `/grupo/${q.group}` : `/servico/${s.id}`)}
                style={({ pressed }) => ({ width: 84, alignItems: "center", gap: 8, paddingVertical: 12, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: pressed ? C.ink : C.line })}>
                <BrandMark slug={s.institution.slug} name={q.label} size={44} round />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>{q.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Assuntos */}
      <View style={{ gap: 12 }}>
        <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>Todos os assuntos</Text>
        <View style={{ backgroundColor: C.white, borderRadius: R.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
          {cats.map((c, i) => {
            const I = categoryIcon(c.slug);
            return (
              <Pressable key={c.slug} accessibilityRole="button" onPress={() => router.push({ pathname: "/servicos", params: { categoria: c.slug } })}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.canvas : C.white })}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                  <I size={20} color={C.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{c.name}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{c.service_count} {c.service_count === 1 ? "serviço" : "serviços"}</Text>
                </View>
                <ChevronRight size={18} color={C.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Acompanhar */}
      <View style={{ backgroundColor: C.ink, borderRadius: 30, padding: 20, gap: 12 }}>
        <Text style={{ fontFamily: F.display, fontSize: 22, color: C.white }}>Já pagou? Veja o estado.</Text>
        <Text style={{ fontFamily: F.body, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>Escreva o código que recebeu (começa por PMZ).</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: R.pill, borderWidth: 1, borderColor: codeErr ? C.accent : "rgba(255,255,255,0.14)", padding: 5 }}>
          <TextInput value={code} onChangeText={(v) => { setCode(v); setCodeErr(""); }} placeholder="PMZ…" placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="characters"
            accessibilityLabel="Código do pagamento" onSubmitEditing={track}
            style={{ flex: 1, minHeight: 46, paddingHorizontal: 14, color: C.white, fontFamily: "monospace", fontSize: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Ver estado" onPress={track}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={20} color={C.ink} />
          </Pressable>
        </View>
        {codeErr ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: "#ff8a8f" }}>{codeErr}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 14, gap: 4 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.muted }}>{label}</Text>
      <Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}
