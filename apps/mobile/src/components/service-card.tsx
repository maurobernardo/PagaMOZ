import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { Entry } from "../lib/catalog";
import { formatMZN } from "../lib/format";
import { t } from "../lib/i18n";
import { C, F, R, shadow } from "../theme";
import { BrandMark } from "./brand";

function price(e: Entry & { kind: "service" }) {
  const s = e.s;
  if (s.variants.length) return `${t("desde")} ${formatMZN(Math.min(...s.variants.map((v) => v.amount)))}`;
  return s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? t("Consulta o valor") : t("Valor à sua escolha");
}

/** Cartão branco com sombra suave: logótipo(s), nome, e o próximo passo. */
export function EntryCard({ e }: { e: Entry }) {
  const isGroup = e.kind === "group";
  const title = isGroup ? e.title : e.s.name;
  const sub = isGroup ? e.prompt : e.s.institution.name;
  const logos = isGroup ? [...new Map(e.options.map((o) => [o.institution.slug, o])).values()] : [e.s];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
      onPress={() => router.push(isGroup ? `/grupo/${e.key}` : `/servico/${e.s.id}`)}
      style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 12, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ flexDirection: "row" }}>
          {logos.slice(0, 3).map((o, i) => (
            <View key={o.id} style={{ marginLeft: i ? -14 : 0, borderRadius: 16, borderWidth: 2, borderColor: C.surface }}>
              <BrandMark slug={o.institution.slug} name={o.group?.option ?? o.institution.name} size={46} round />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 16, lineHeight: 21, color: C.ink }} numberOfLines={2}>{title}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }} numberOfLines={1}>{sub}</Text>
        </View>
        <ChevronRight size={20} color={C.muted} />
      </View>
      {isGroup ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {e.options.map((o) => (
            <View key={o.id} style={{ backgroundColor: C.soft, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.ink }}>{o.group?.option}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ alignSelf: "flex-start", backgroundColor: C.soft, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.ink }}>{price(e)}</Text>
        </View>
      )}
    </Pressable>
  );
}
