import { router, useFocusEffect } from "expo-router";
import { CalendarClock, Camera, Images, Zap } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandMark } from "../components/brand";
import { Alert, Button, Card, H2, Header, Loading, P, PageTitle, Progress } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { formatMZN } from "../lib/format";
import { t } from "../lib/i18n";
import { openPrefilled, scanBill, type Bill, type Bills } from "../lib/intel";
import { useMe } from "../lib/me";
import { C, F, shadow } from "../theme";

const when = (d: number | null | undefined) =>
  d == null ? "-" : d < 0 ? t("Já passou") : d === 0 ? t("Hoje") : d === 1 ? t("Amanhã") : `${t("Daqui a")} ${d} ${t("dias")}`;

/** Contas da casa: o que costuma pagar, quando volta a vencer, e quanto tempo dura a energia. */
export default function Contas() {
  const { me } = useMe();
  const [b, setB] = useState<Bills | null>(null);
  const [error, setError] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  useFocusEffect(useCallback(() => {
    api<Bills>("/api/intel/bills").then(setB).catch((e) => setError(errorMessage(e)));
  }, []));

  const scan = async (camera: boolean) => setScanMsg((await scanBill(camera)) ?? "");

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Contas da casa")} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 60 }}>
        <PageTitle title={t("Contas da casa")} sub={t("O que costuma pagar e quando volta a vencer.")} />

        <Card dark style={{ gap: 12 }}>
          <Text style={{ fontFamily: F.display, fontSize: 19, color: C.onHero }}>{t("Fotografe e pague")}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{t("Tire uma foto da fatura e nós preenchemos o resto.")}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button variant="light" icon={Camera} style={{ flex: 1 }} onPress={() => scan(true)}>{t("Câmara")}</Button>
            <Button variant="light" icon={Images} style={{ flex: 1 }} onPress={() => scan(false)}>{t("Galeria")}</Button>
          </View>
        </Card>
        {scanMsg ? <Alert>{scanMsg}</Alert> : null}

        {me === null ? (
          <Card style={{ gap: 12 }}>
            <P muted>{t("Entre para vermos as suas contas que se repetem e avisarmos antes de vencerem.")}</P>
            <Button onPress={() => router.push("/cadastro?entrar=1")}>{t("Entrar")}</Button>
          </Card>
        ) : error ? <Alert>{error}</Alert> : !b ? <Loading /> : (
          <>
            {b.credelec.map((c) => <CredelecCard key={c.key} c={c} />)}

            <H2>{t("Próximas contas")}</H2>
            {b.recurring.length === 0 ? (
              <P muted>{t("Quando pagar a mesma conta duas vezes, ela aparece aqui com a próxima data.")}</P>
            ) : b.recurring.map((r) => (
              <Pressable key={`${r.service}-${r.key}`} accessibilityRole="button" onPress={() => openPrefilled(r.service, r.payload, r.typical_amount)}
                style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 10, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <BrandMark slug={r.institution_slug} name={r.institution_name} size={42} round />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }} numberOfLines={1}>{t(r.service_name)}</Text>
                    <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{r.key} · {r.explain}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: F.display, fontSize: 15, color: C.ink }}>{formatMZN(r.typical_amount ?? r.last_amount).replace(",00", "")}</Text>
                    <Text style={{ fontFamily: F.semi, fontSize: 12, color: (r.days_left ?? 99) <= 2 ? C.accent : C.muted }}>{when(r.days_left)}</Text>
                  </View>
                </View>
                <Progress value={r.every_days ? 1 - Math.max(0, Math.min(1, (r.days_left ?? 0) / r.every_days)) : 0}
                  tone={(r.days_left ?? 99) <= 2 ? C.accent : C.ink} />
              </Pressable>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CalendarClock size={14} color={C.muted} />
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 12, color: C.muted }}>{t("Datas estimadas a partir dos seus pagamentos. Avisamos 2 dias antes.")}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CredelecCard({ c }: { c: Bill }) {
  const low = c.days_left != null && c.days_left <= 3;
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: low ? C.accentSoft : C.soft, alignItems: "center", justifyContent: "center" }}>
          <Zap size={20} color={low ? C.accent : C.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{t("Energia Credelec")}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{t("Contador")} {c.key}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: F.display, fontSize: 22, color: low ? C.accent : C.ink }}>{c.days_left == null ? "-" : `~${Math.max(0, c.days_left)}`}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{t("dias de energia")}</Text>
        </View>
      </View>
      <P muted size={13}>{c.explain}{c.monthly ? ` ${t("Cerca de")} ${formatMZN(c.monthly).replace(",00", "")} ${t("por mês")}.` : ""}</P>
      <Button variant={low ? "primary" : "secondary"} icon={Zap} onPress={() => openPrefilled(c.service, c.payload, c.last_amount)}>
        {`${t("Recarregar")} ${formatMZN(c.last_amount).replace(",00", "")}`}
      </Button>
    </Card>
  );
}
