import { Redirect, router, useFocusEffect } from "expo-router";
import { CheckCircle2, Clock3, MapPin, Pencil, XCircle } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandMark } from "../components/brand";
import { Bars, Donut } from "../components/charts";
import { Alert, Card, H2, Header, Loading, P, Progress, Ring, RoundButton, Segmented } from "../components/ui";
import { api, errorMessage, type Payment } from "../lib/api";
import { formatDateTime, formatMZN, PAYMENT_STATUS } from "../lib/format";
import { t } from "../lib/i18n";
import { prettyPhone, shortName, useMe } from "../lib/me";
import { Avatar } from "../components/avatar";
import { C, F, shadow } from "../theme";

type Filter = "all" | "ok" | "wait" | "bad";
const toneOf = (s: string): Exclude<Filter, "all"> => (["CONFIRMADA", "LIQUIDADA"].includes(s) ? "ok" : ["CRIADA", "PENDENTE"].includes(s) ? "wait" : "bad");
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Perfil: quem é, quanto pagou por mês, onde pagou mais e o histórico. */
export default function Perfil() {
  const { me } = useMe();
  const [items, setItems] = useState<Payment[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const load = useCallback(async () => {
    try {
      const r = await api<Payment[] | { results: Payment[] }>("/api/me/payments");
      setItems(Array.isArray(r) ? r : r.results);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (me === undefined) return <View style={{ flex: 1, backgroundColor: C.canvas }}><Header /><Loading /></View>;
  if (!me) return <Redirect href="/cadastro?entrar=1" />;

  const list = items ?? [];
  const paid = list.filter((p) => toneOf(p.status) === "ok");
  const shown = filter === "all" ? list : list.filter((p) => toneOf(p.status) === filter);
  const where = [me.district, me.province].filter(Boolean).join(", ");

  // Últimos 6 meses (hora de Maputo).
  const now = new Date(Date.now() + 2 * 3600_000);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const bars = months.map(({ y, m }) => ({
    label: MONTHS_PT[m],
    value: paid.filter((p) => { const d = new Date(new Date(p.created_at).getTime() + 2 * 3600_000); return d.getUTCFullYear() === y && d.getUTCMonth() === m; })
      .reduce((a, p) => a + p.total, 0),
  }));
  const byInst = Object.values(paid.reduce<Record<string, { label: string; value: number }>>((acc, p) => {
    (acc[p.institution_name] ??= { label: p.institution_name, value: 0 }).value += p.total;
    return acc;
  }, {})).sort((a, b) => b.value - a.value);
  const donut = byInst.length > 4 ? [...byInst.slice(0, 4), { label: t("Outros"), value: byInst.slice(4).reduce((a, d) => a + d.value, 0) }] : byInst;
  const thisMonth = bars[bars.length - 1].value;

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Perfil")} right={<RoundButton icon={Pencil} label={t("Editar perfil")} onPress={() => router.push("/perfil-editar")} />} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 60 }}>
        {/* Quem é */}
        <View style={{ alignItems: "center", gap: 6, paddingVertical: 6 }}>
          <Avatar me={me} size={92} />
          <Text style={{ fontFamily: F.display, fontSize: 24, letterSpacing: -0.5, color: C.ink }}>{shortName(me)}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>{prettyPhone(me.phone)}{me.email ? ` · ${me.email}` : ""}</Text>
          {where ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surface, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, ...shadow() }}>
              <MapPin size={13} color={C.ink} />
              <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.ink }}>{where}</Text>
            </View>
          ) : null}
        </View>

        {error ? <Alert>{error}</Alert> : null}
        {items === null ? <Loading /> : (
          <>
            {/* Este mês + anel */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Card dark style={{ flex: 1, justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("Este mês")}</Text>
                <Text style={{ fontFamily: F.display, fontSize: 24, color: C.onHero }} adjustsFontSizeToFit numberOfLines={1}>{formatMZN(thisMonth).replace(",00", "")}</Text>
                <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{`${paid.length} ${t("pagamentos concluídos")}`}</Text>
              </Card>
              <Card style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16 }}>
                <Ring value={list.length ? paid.length / list.length : 0} size={104}>
                  <Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink }}>{paid.length}/{list.length}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{t("Pagos")}</Text>
                </Ring>
              </Card>
            </View>

            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <H2>{t("Gastos por mês")}</H2>
                <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{t("6 meses")}</Text>
              </View>
              <Bars data={bars} />
            </Card>

            {donut.length ? (
              <Card style={{ gap: 14 }}>
                <H2>{t("Onde pagou mais")}</H2>
                <Donut data={donut} center={String(byInst.length)} />
              </Card>
            ) : null}

            <Segmented<Filter> value={filter} onChange={setFilter}
              options={[{ key: "all", label: t("Todos") }, { key: "ok", label: t("Pagos") }, { key: "wait", label: t("Pendentes") }, { key: "bad", label: t("Falhados") }]} />

            {shown.length === 0 ? <P muted>{t("Ainda não pagou nada com esta conta.")}</P> : shown.map((p) => {
              const tone = toneOf(p.status);
              const color = { ok: C.ok, wait: C.wait, bad: C.accent }[tone];
              const Icon = { ok: CheckCircle2, wait: Clock3, bad: XCircle }[tone];
              return (
                <Pressable key={p.reference} accessibilityRole="button" onPress={() => router.push(`/pagamento/${p.reference}`)}
                  style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 10, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <BrandMark slug={p.institution_slug} name={p.institution_name} size={42} round />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }} numberOfLines={1}>{p.service_name}</Text>
                      <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{formatDateTime(p.created_at)} · {formatMZN(p.total)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontFamily: F.semi, fontSize: 12, color }}>{PAYMENT_STATUS[p.status]?.label}</Text>
                      <Icon size={15} color={color} />
                    </View>
                  </View>
                  <Progress value={tone === "wait" ? 0.5 : 1} tone={color} />
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
