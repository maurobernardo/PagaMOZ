import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Clock3, Share2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { Alert, Button, Card, Header, Loading, Progress } from "../../components/ui";
import { api, errorMessage, WEB } from "../../lib/api";
import { formatMZN } from "../../lib/format";
import { t } from "../../lib/i18n";
import { openPrefilled } from "../../lib/intel";
import { C, F, shadow } from "../../theme";

type Share_ = { id: number; position: number; name: string; amount: number; state: "por_pagar" | "a_pagar" | "pago"; reference: string | null };
type Split = { code: string; title: string; total: number; paid: number; service: number; institution_name: string; fields: Record<string, string>; shares: Share_[] };

/** Conta dividida: quem já pagou, quanto falta, e partilhar o link com as outras pessoas. */
export default function Dividir() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [d, setD] = useState<Split | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<Split>(`/api/splits/${code}`).then(setD).catch((e) => setError(errorMessage(e)));
  }, [code]);
  useFocusEffect(load);
  useEffect(() => {
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const link = `${WEB}/dividir/${code}`;
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Conta dividida")} />
      {error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : !d ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
          <Card dark style={{ gap: 10 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{d.institution_name} · {d.shares.length} {t("pessoas")}</Text>
            <Text style={{ fontFamily: F.display, fontSize: 22, color: C.onHero }}>{d.title}</Text>
            <Text style={{ fontFamily: F.display, fontSize: 30, color: C.onHero }}>{formatMZN(d.paid)} <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>/ {formatMZN(d.total)}</Text></Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
              <View style={{ width: `${(d.paid / d.total) * 100}%`, height: 6, backgroundColor: C.onHero }} />
            </View>
            <Button variant="light" icon={Share2} onPress={() => Share.share({ message: `${t("Vamos dividir")} ${d.title}. ${t("Paga a tua parte aqui")}: ${link}` })}>{t("Partilhar link")}</Button>
          </Card>
          {d.shares.map((s) => (
            <View key={s.id} style={{ backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 10, ...shadow() }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {s.state === "pago" ? <CheckCircle2 size={22} color={C.ok} /> : <Clock3 size={22} color={C.muted} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{t(s.name)}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{formatMZN(s.amount)} · {t(s.state === "pago" ? "Pago" : s.state === "a_pagar" ? "A pagar agora" : "Por pagar")}</Text>
                </View>
                {s.state === "por_pagar" ? (
                  <Pressable accessibilityRole="button" onPress={() => openPrefilled(d.service, d.fields, s.amount, "", String(s.id))}
                    style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: C.ink, justifyContent: "center" }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.white }}>{t("Pagar esta parte")}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Progress value={s.state === "pago" ? 1 : s.state === "a_pagar" ? 0.5 : 0} tone={s.state === "pago" ? C.ok : C.ink} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
