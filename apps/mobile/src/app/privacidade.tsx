import { CreditCard, Database, Landmark, Smartphone, Trash2 } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { Card, H2, Header, P, PageTitle } from "../components/ui";
import { t } from "../lib/i18n";
import { C } from "../theme";
import type { LucideIcon } from "lucide-react-native";

/** O que a app guarda e porquê, em linguagem simples (descreve o que o sistema faz de facto). */
const POINTS: [LucideIcon, string, string][] = [
  [Landmark, "Não guardamos o seu dinheiro", "O pagamento vai directamente para a conta da instituição. O PagaMOZ só regista que o pagamento aconteceu."],
  [CreditCard, "Cartão", "O número completo e o CVV nunca saem do seu telemóvel. Guardamos apenas a marca e os últimos 4 algarismos para o comprovativo."],
  [Database, "O que registamos", "O seu número de telefone (para entrar), os pagamentos que faz e, se quiser, nome, email, província e distrito. Os dados que escreve para cada serviço vão para a instituição que o presta."],
  [Smartphone, "Neste telemóvel", "Ficam guardadas as suas preferências (tema, idioma, notificações) e a sessão. Não usamos publicidade nem estatísticas de terceiros."],
  [Trash2, "Apagar", "Em Definições pode apagar a sua conta: os dados pessoais são apagados. Os registos de pagamento ficam no servidor, sem ligação a si, porque são a prova de que pagou."],
];

export default function Privacidade() {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Privacidade")} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <PageTitle title={t("Política de privacidade")} />
        {POINTS.map(([I, title, body]) => (
          <Card key={title} style={{ gap: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
              <I size={18} color={C.ink} />
            </View>
            <H2>{title}</H2>
            <P muted size={14}>{body}</P>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
