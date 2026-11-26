import { router, useFocusEffect } from "expo-router";
import { ArrowRight, Bell, ChevronRight, Moon, Receipt, Search, Settings, Sun, Wallet } from "lucide-react-native";
import { HeroArt } from "../../components/hero-art";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark, categoryIcon, LogoMark } from "../../components/brand";
import { RoundButton } from "../../components/ui";
import { api, type Payment, type Service } from "../../lib/api";
import { useCategories, useServices } from "../../lib/catalog";
import { formatMZN, PAYMENT_STATUS } from "../../lib/format";
import { t } from "../../lib/i18n";
import { C, F, R, shadow } from "../../theme";

type Me = { phone: string; first_name?: string };

function greeting() {
  const h = (new Date().getUTCHours() + 2) % 24; // Maputo
  return t(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
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
  const [me, setMe] = useState<Me | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [heroW, setHeroW] = useState(0);

  const loadMe = useCallback(() => {
    api<Me>("/api/me")
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
    else setCodeErr(t("O código começa por PMZ e tem 13 caracteres."));
  };

  const sunny = (new Date().getUTCHours() + 2) % 24 < 18;
  return (
    <ScrollView style={{ backgroundColor: C.canvas }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120, gap: 18 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); loadMe(); }} tintColor={C.ink} />}>
      {/* Topo ilustrado: logótipo, sino, saudação */}
      <View onLayout={(e) => setHeroW(e.nativeEvent.layout.width)} style={{ marginHorizontal: -18, paddingTop: top + 8, paddingHorizontal: 18, paddingBottom: 64, backgroundColor: C.soft, overflow: "hidden" }}>
        {heroW ? <HeroArt width={heroW} height={top + 230} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <LogoMark size={34} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <RoundButton icon={Bell} label={t("Notificações")} onPress={() => router.push("/notificacoes")} />
            <RoundButton icon={Settings} label={t("Definições")} onPress={() => router.push("/conta")} />
          </View>
        </View>
        <View style={{ marginTop: 26, gap: 2 }}>
          <Text style={{ fontFamily: F.body, fontSize: 18, color: C.ink }}>{greeting()},</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: F.display, fontSize: 34, letterSpacing: -1, color: C.ink }} numberOfLines={1}>
              {me?.first_name || (me ? me.phone.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3") : "PagaMOZ")}
            </Text>
            {sunny ? <Sun size={26} color={C.ink} /> : <Moon size={24} color={C.ink} />}
          </View>
          <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 21, color: C.muted, maxWidth: 260 }}>{t("O que vamos pagar hoje? Sem filas, com comprovativo na hora.")}</Text>
        </View>
      </View>

      {/* Cartão sobreposto */}
      <Pressable accessibilityRole="button" onPress={() => router.push(last ? `/pagamento/${last.reference}` : "/servicos")}
        style={({ pressed }) => ({ marginTop: -46, backgroundColor: C.surface, borderRadius: R.card, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
        {last ? <BrandMark slug={last.institution_slug} name={last.institution_name} size={50} round /> : (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}><Search size={22} color={C.ink} /></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{last ? t("Último pagamento") : t("Pesquisar")}</Text>
          <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.ink }} numberOfLines={1}>{last ? last.service_name : t("Pesquisar serviço ou instituição")}</Text>
          {last ? <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.muted }}>{PAYMENT_STATUS[last.status]?.label} · {formatMZN(last.total)}</Text> : null}
        </View>
        <ChevronRight size={20} color={C.ink} />
      </Pressable>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat icon={Receipt} label={t("Pagamentos")} value={me ? String(payments.length) : "-"} sub={me ? t("no total") : t("Entre para ver")} />
        <Stat icon={Wallet} label={t("Total pago")} value={me ? formatMZN(paid.reduce((a, p) => a + p.total, 0)).replace(",00", "").replace(" MT", "") : "-"} sub="MT" />
      </View>

      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{t("Pagar rápido")}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{t("Os pagamentos mais comuns, a um toque.")}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 8 }}>
          {QUICK.map((q) => {
            const s = services?.find(q.find);
            if (!s) return null;
            return (
              <Pressable key={q.label} accessibilityRole="button" accessibilityLabel={q.label}
                onPress={() => router.push(q.group ? `/grupo/${q.group}` : `/servico/${s.id}`)}
                style={({ pressed }) => ({ width: 82, alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: 22, backgroundColor: C.surface, transform: [{ scale: pressed ? 0.96 : 1 }], ...shadow() })}>
                <BrandMark slug={s.institution.slug} name={q.label} size={44} round />
                <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.ink }}>{q.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{t("Todos os assuntos")}</Text>
        <View style={{ backgroundColor: C.surface, borderRadius: R.card, overflow: "hidden", ...shadow() }}>
          {cats.map((c, i) => {
            const I = categoryIcon(c.slug);
            return (
              <Pressable key={c.slug} accessibilityRole="button" onPress={() => router.push({ pathname: "/servicos", params: { categoria: c.slug } })}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.soft : "transparent" })}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
                  <I size={19} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{c.name}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{c.service_count} {t(c.service_count === 1 ? "serviço" : "serviços")}</Text>
                </View>
                <ChevronRight size={18} color={C.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ backgroundColor: C.hero, borderRadius: R.card, padding: 20, gap: 12 }}>
        <Text style={{ fontFamily: F.display, fontSize: 20, color: C.onHero }}>{t("Já pagou? Veja o estado.")}</Text>
        <Text style={{ fontFamily: F.body, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{t("Escreva o código que recebeu (começa por PMZ).")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: R.pill, borderWidth: 1, borderColor: codeErr ? C.accent : "rgba(255,255,255,0.14)", padding: 5 }}>
          <TextInput value={code} onChangeText={(v) => { setCode(v); setCodeErr(""); }} placeholder="PMZ…" placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="characters"
            accessibilityLabel="PMZ" onSubmitEditing={track}
            style={{ flex: 1, minHeight: 46, paddingHorizontal: 14, color: C.onHero, fontFamily: "monospace", fontSize: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={t("Estado")} onPress={track}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.onHero, alignItems: "center", justifyContent: "center" }}>
            <ArrowRight size={20} color="#0b0b0c" />
          </Pressable>
        </View>
        {codeErr ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: "#ff8a8f" }}>{codeErr}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Wallet; label: string; value: string; sub: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, ...shadow() }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={C.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{label}</Text>
        <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }} numberOfLines={1} adjustsFontSizeToFit>
          {value} <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{sub}</Text>
        </Text>
      </View>
    </View>
  );
}
