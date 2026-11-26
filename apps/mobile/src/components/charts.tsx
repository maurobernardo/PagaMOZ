import { Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { C, F, isDark } from "../theme";

/** Barras verticais simples (ex.: total pago por mês). A barra do mês actual fica a preto. */
export function Bars({ data, height = 140 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height: height + 22 }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * height);
        const last = i === data.length - 1;
        return (
          <View key={d.label} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ width: "100%", height: h, borderRadius: 10, backgroundColor: last ? C.ink : C.soft }} />
            <Text style={{ fontFamily: last ? F.bold : F.body, fontSize: 11, color: last ? C.ink : C.muted }}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Tons de cinzento para as fatias (preto e branco, como a marca). */
const SHADES_LIGHT = ["#0b0b0c", "#4a4a4d", "#85857f", "#b9b8b1", "#dcdbd4"];
const SHADES_DARK = ["#f4f4f1", "#bdbdb8", "#8a8a85", "#5c5c59", "#3a3a3c"];

/** Donut com legenda (ex.: onde pagou mais). */
export function Donut({ data, size = 128, center }: { data: { label: string; value: number }[]; size?: number; center?: string }) {
  const shades = isDark ? SHADES_DARK : SHADES_LIGHT;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const sw = 18;
  const r = (size - sw) / 2;
  const len = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.soft} strokeWidth={sw} fill="none" />
          {data.map((d, i) => {
            const part = (d.value / total) * len;
            const el = <Circle key={d.label} cx={size / 2} cy={size / 2} r={r} stroke={shades[i % shades.length]} strokeWidth={sw} fill="none"
              strokeDasharray={`${Math.max(0, part - 2)} ${len}`} strokeDashoffset={-acc} />;
            acc += part;
            return el;
          })}
        </Svg>
        {center ? <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{center}</Text> : null}
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        {data.map((d, i) => (
          <View key={d.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Svg width={10} height={10}><Rect width={10} height={10} rx={3} fill={shades[i % shades.length]} /></Svg>
            <Text style={{ flex: 1, fontFamily: F.body, fontSize: 12, color: C.ink }} numberOfLines={1}>{d.label}</Text>
            <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.muted }}>{Math.round((d.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
