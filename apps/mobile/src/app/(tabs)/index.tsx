import { router, useFocusEffect } from "expo-router";
import { ArrowRight, Bell, CalendarClock, Camera, ChevronRight, CreditCard, Moon, Search, ShieldCheck, Sun, UserRound } from "lucide-react-native";
import { scanBill, type Bills } from "../../lib/intel";
import { Alert } from "../../components/ui";
import { Avatar } from "../../components/avatar";
import { shortName, type Me as FullMe } from "../../lib/me";
import { Image } from "expo-image";
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

type Me = FullMe;

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
  const [scanMsg, setScanMsg] = useState("");
  const [bills, setBills] = useState<Bills | null>(null);

  const loadMe = useCallback(() => {
    api<Me>("/api/me")
      .then(async (m) => {
        setMe(m);
        const r = await api<Payment[] | { results: Payment[] }>("/api/me/payments");
        setPayments(Array.isArray(r) ? r : r.results);
        setBills(await api<Bills>("/api/intel/bills"));
      })
      .catch(() => { setMe(null); setPayments([]); });
  }, []);
  useFocusEffect(loadMe);

  const last = payments[0];
  // Próximas contas (as 3 mais perto) e energia a acabar.
  const next = [
    ...(bills?.credelec ?? []).filter((c) => c.days_left != null).map((c) => ({ label: `Credelec ${c.key}`, slug: c.institution_slug, d: c.days_left as number, energy: true })),
    ...(bills?.recurring ?? []).map((r) => ({ label: r.service_name, slug: r.institution_slug, d: r.days_left as number, energy: false })),
  ].sort((a, b) => a.d - b.d).slice(0, 3).map((n) => ({
    ...n, urgent: n.d <= (n.energy ? 3 : 2),
    when: n.energy ? `~${Math.max(0, n.d)} ${t("dias de energia")}` : n.d <= 0 ? t("Hoje") : `${t("Daqui a")} ${n.d} ${t("dias")}`,
  }));
  const paid = payments.filter((p) => ["CONFIRMADA", "LIQUIDADA"].includes(p.status));
  // Este mês e mini-barras dos últimos 6 meses (hora de Maputo).
  const ym = (iso: string) => { const d = new Date(new Date(iso).getTime() + 2 * 3600_000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const nowYm = ym(new Date().toISOString());
  const thisMonth = paid.filter((p) => ym(p.created_at) === nowYm);
  const monthTotal = thisMonth.reduce((a, p) => a + p.total, 0);
  const monthCount = thisMonth.length;
  const sums = Array.from({ length: 6 }, (_, k) => paid.filter((p) => ym(p.created_at) === nowYm - 5 + k).reduce((a, p) => a + p.total, 0));
  const spark = sums.map((v) => v / Math.max(1, ...sums));
  const track = () => {
    const c = code.toUpperCase().replace(/[\s-]/g, "");
    if (/^PMZ[0-9A-Z]{10}$/.test(c)) router.push(`/pagamento/${c}`);
    else setCodeErr(t("O código começa por PMZ e tem 13 caracteres."));
  };

  const sunny = (new Date().getUTCHours() + 2) % 24 < 18;
  return (
    <ScrollView style={{ backgroundColor: C.canvas }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120, gap: 18 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); loadMe(); }} tintColor={C.ink} />}>
      {/* Topo com fotografia (pagamento com telemóvel), escurecida para o texto branco se ler bem */}
      <View style={{ marginHorizontal: -18, paddingTop: top, paddingHorizontal: 18, paddingBottom: 56, backgroundColor: C.hero, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Image source={require("../../../assets/hero.webp")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <LogoMark size={32} color={C.onHero} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <RoundButton dark icon={Bell} label={t("Notificações")} onPress={() => router.push("/notificacoes")} />
            {me ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("Perfil")} onPress={() => router.push("/perfil")}
                style={{ borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)" }}>
                <Avatar me={me} size={40} />
              </Pressable>
            ) : (
              <RoundButton dark icon={UserRound} label={t("Entrar")} onPress={() => router.push("/cadastro?entrar=1")} />
            )}
          </View>
        </View>
        {/* Saudação: pílula de vidro + nome */}
        <View style={{ marginTop: 18, gap: 8 }}>
          <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
            {sunny ? <Sun size={13} color={C.onHero} /> : <Moon size={13} color={C.onHero} />}
            <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.onHero }}>{greeting()}</Text>
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 30, letterSpacing: -0.9, color: C.onHero }} numberOfLines={1}>{me ? shortName(me) : t("Pague sem filas")}</Text>
        </View>

        {/* Cartão de vidro: este mês */}
        <Pressable accessibilityRole="button" onPress={() => router.push(me ? "/perfil" : "/cadastro")}
          style={{ marginTop: 16, borderRadius: 22, padding: 16, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{me ? t("Pago este mês") : t("Comece agora")}</Text>
            <Text style={{ fontFamily: F.display, fontSize: 26, letterSpacing: -0.6, color: C.onHero }} numberOfLines={1} adjustsFontSizeToFit>
              {me ? formatMZN(monthTotal).replace(",00", "") : t("Criar conta")}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{me ? `${monthCount} ${t("pagamentos")}` : t("Histórico e comprovativos guardados")}</Text>
          </View>
          {me ? (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 44 }}>
              {spark.map((v, k) => (
                <View key={k} style={{ width: 7, height: Math.max(4, v * 44), borderRadius: 4, backgroundColor: k === spark.length - 1 ? C.onHero : "rgba(255,255,255,0.35)" }} />
              ))}
            </View>
          ) : <ArrowRight size={22} color={C.onHero} />}
        </Pressable>

        {/* Atalhos */}
        <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between" }}>
          {([[CreditCard, "Pagar", "/servicos"], [Camera, "Fotografar", "scan"], [CalendarClock, "Contas", "/contas"], [ShieldCheck, "Verificar", "/verificar"]] as const).map(([I, label, href]) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={t(label)} style={{ alignItems: "center", gap: 6, width: 72 }}
              onPress={async () => (href === "scan" ? setScanMsg((await scanBill(true)) ?? "") : router.push(href))}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <I size={21} color={C.onHero} />
              </View>
              <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.onHero }}>{t(label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {scanMsg ? <Alert>{scanMsg}</Alert> : null}
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


      {next.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/contas")}
          style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 10, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>{t("Próximas contas")}</Text>
            <ChevronRight size={18} color={C.muted} />
          </View>
          {next.map((n) => (
            <View key={n.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <BrandMark slug={n.slug} name={n.label} size={30} round />
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink }} numberOfLines={1}>{n.label}</Text>
              <Text style={{ fontFamily: F.semi, fontSize: 13, color: n.urgent ? C.accent : C.muted }}>{n.when}</Text>
            </View>
          ))}
        </Pressable>
      ) : null}

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
