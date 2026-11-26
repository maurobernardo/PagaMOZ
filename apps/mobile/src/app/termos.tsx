import { ScrollView, View } from "react-native";
import { Card, H2, Header, P, PageTitle } from "../components/ui";
import { t } from "../lib/i18n";
import { TERMS } from "../lib/legal";
import { C } from "../theme";

/** Termos de utilização (o mesmo texto da web). */
export default function Termos() {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Termos de utilização")} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }}>
        <PageTitle title={t("Termos de utilização")} sub={TERMS.updated} />
        {TERMS.sections.map((s) => (
          <Card key={s.title} style={{ gap: 6 }}>
            <H2>{s.title}</H2>
            <P muted size={14}>{s.body}</P>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
