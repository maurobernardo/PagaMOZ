import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Circle } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Alert, Card, Header, Loading, PageTitle } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { t } from "../../lib/i18n";
import { C, F } from "../../theme";

type Req = { code: string; status: string; service_name: string; institution_name: string; created_at: string; events: { status: string; note: string; created_at: string }[] };

const STATUS: Record<string, string> = {
  AGUARDA_PAGAMENTO: "A aguardar pagamento", SUBMETIDO: "Submetido à instituição", EM_ANALISE: "Em análise",
  PENDENTE_INFO: "Falta informação", APROVADO: "Aprovado", PRONTO: "Pronto para levantamento",
  CONCLUIDO: "Concluído", REJEITADO: "Rejeitado", CANCELADO: "Cancelado",
};

/** Acompanhar um pedido (passaporte, DIRE…): estado actual e a história dos passos. */
export default function Pedido() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [r, setR] = useState<Req | null>(null);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    api<Req>(`/api/requests/${code}`).then(setR).catch((e) => setError(errorMessage(e)));
  }, [code]));

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Pedido")} />
      {error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : !r ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 60 }}>
          <PageTitle title={t(r.service_name)} sub={`${r.institution_name} · ${r.code}`} />
          <Card dark style={{ gap: 6 }}>
            <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("Estado")}</Text>
            <Text style={{ fontFamily: F.display, fontSize: 24, color: C.onHero }}>{t(STATUS[r.status] ?? r.status)}</Text>
            {r.status === "PENDENTE_INFO" ? <Text style={{ fontFamily: F.body, fontSize: 14, color: "rgba(255,255,255,0.75)" }}>{t("A instituição precisa de mais informação. Veja a nota abaixo.")}</Text> : null}
          </Card>
          <Card style={{ gap: 0 }}>
            {r.events.map((e, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}>
                {i === r.events.length - 1 ? <CheckCircle2 size={20} color={C.ink} /> : <Circle size={20} color={C.muted} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{t(STATUS[e.status] ?? e.status)}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{formatDateTime(e.created_at)}</Text>
                  {e.note ? <Text style={{ fontFamily: F.body, fontSize: 14, color: C.ink, marginTop: 4 }}>{e.note}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}
