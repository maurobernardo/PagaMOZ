import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { Entry } from "../lib/catalog";
import { formatMZN } from "../lib/format";
import { C, F, R } from "../theme";
import { BrandMark } from "./brand";

function price(e: Entry & { kind: "service" }) {
  const s = e.s;
  if (s.variants.length) return `desde ${formatMZN(Math.min(...s.variants.map((v) => v.amount)))}`;
  return s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? "Consulta o valor" : "Valor à sua escolha";
}

/** Linha grande e fácil de tocar: logótipo, nome e o que acontece a seguir. */
export function EntryCard({ e }: { e: Entry }) {
  const isGroup = e.kind === "group";
  const title = isGroup ? e.title : e.s.name;
  const sub = isGroup ? e.prompt : e.s.institution.name;
  const logos = isGroup ? [...new Map(e.options.map((o) => [o.institution.slug, o])).values()] : [e.s];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
      onPress={() => router.push(isGroup ? `/grupo/${e.key}` : `/servico/${e.s.id}`)}
      style={({ pressed }) => ({ backgroundColor: C.white, borderRadius: R.card, borderWidth: 1, borderColor: pressed ? C.ink : C.line, padding: 16, gap: 14, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ flexDirection: "row" }}>
          {logos.slice(0, 3).map((o, i) => (
            <View key={o.id} style={{ marginLeft: i ? -14 : 0, borderRadius: 16, borderWidth: 2, borderColor: C.white }}>
              <BrandMark slug={o.institution.slug} name={o.group?.option ?? o.institution.name} size={48} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: F.display, fontSize: 18, lineHeight: 22, color: C.ink }} numberOfLines={2}>{title}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }} numberOfLines={1}>{sub}</Text>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.canvas, alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={20} color={C.ink} />
        </View>
      </View>
      {isGroup ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {e.options.map((o) => (
            <View key={o.id} style={{ backgroundColor: C.ink, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.white }}>{o.group?.option}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>{price(e)}</Text>
      )}
    </Pressable>
  );
}
