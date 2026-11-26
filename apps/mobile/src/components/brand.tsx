import { Image } from "expo-image";
import {
  Building, Car, CreditCard, GraduationCap, HeartPulse, IdCard, Landmark, LayoutGrid, QrCode, Zap, type LucideIcon,
} from "lucide-react-native";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme";

/** Logótipo PagaMOZ: só o "P" com o visto vermelho, sem fundo nem nome. */
export function LogoMark({ size = 36, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="8 5 24 30">
      <Path d="M13 31V9h8.5a7.5 7.5 0 0 1 0 15H17" fill="none" stroke={color ?? C.ink} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.3 16.7l2.1 2.1 3.6-3.8" fill="none" stroke={C.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Os mesmos ficheiros de apps/web/public/logos (ver LEIA-ME.md lá).
const LOGOS: Record<string, number> = {
  adrmm: require("../../assets/logos/adrmm.webp"), at: require("../../assets/logos/at.webp"), cmm: require("../../assets/logos/cmm.webp"),
  dstv: require("../../assets/logos/dstv.svg"), edm: require("../../assets/logos/edm.webp"), emola: require("../../assets/logos/emola.webp"),
  emose: require("../../assets/logos/emose.webp"), hcm: require("../../assets/logos/hcm.webp"), inatter: require("../../assets/logos/inatter.webp"),
  inss: require("../../assets/logos/inss.webp"), mastercard: require("../../assets/logos/mastercard.svg"), mkesh: require("../../assets/logos/mkesh.webp"),
  movitel: require("../../assets/logos/movitel.webp"), mpesa: require("../../assets/logos/mpesa.svg"), senami: require("../../assets/logos/senami.webp"),
  tmcel: require("../../assets/logos/tmcel.webp"), tvcabo: require("../../assets/logos/tvcabo.svg"), uem: require("../../assets/logos/uem.webp"),
  "fipag": require("../../assets/logos/fipag.webp"),
  "gotv": require("../../assets/logos/gotv.webp"),
  "isctem": require("../../assets/logos/isctem.webp"),
  "isutc": require("../../assets/logos/isutc.webp"),
  "startimes": require("../../assets/logos/startimes.webp"),
  "ucm": require("../../assets/logos/ucm.webp"),
  "ujc": require("../../assets/logos/ujc.webp"),
  "up-maputo": require("../../assets/logos/up-maputo.webp"),
  "unizambeze": require("../../assets/logos/unizambeze.webp"),
  "cmb": require("../../assets/logos/cmb.webp"),
  "hcb": require("../../assets/logos/hcb.webp"),
  "hcn": require("../../assets/logos/hcn.webp"),
  "hollard": require("../../assets/logos/hollard.webp"),
  "cmcm": require("../../assets/logos/cmcm.webp"),
  visa: require("../../assets/logos/visa.svg"), vodacom: require("../../assets/logos/vodacom.svg"), zap: require("../../assets/logos/zap.webp"),
};

/** Logótipo da marca; sem ficheiro mostra as iniciais num quadrado preto. */
export function BrandMark({ slug, name, size = 48, round = false }: { slug: string; name: string; size?: number; round?: boolean }) {
  const radius = round ? size / 2 : size * 0.28;
  const src = LOGOS[slug];
  if (src)
    return (
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#ffffff", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Image source={src} style={{ width: size * (round ? 0.68 : 0.8), height: size * (round ? 0.68 : 0.8) }} contentFit="contain" accessibilityLabel={name} />
      </View>
    );
  const initials = name.replace(/\(.*?\)/g, "").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <View accessibilityLabel={name} style={{ width: size, height: size, borderRadius: radius, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.32, color: C.white }}>{initials}</Text>
    </View>
  );
}

const CATEGORY: Record<string, LucideIcon> = {
  documentos: IdCard, transportes: Car, "servicos-basicos": Zap, impostos: Landmark, educacao: GraduationCap, saude: HeartPulse, municipios: Building, outros: LayoutGrid,
};
export const categoryIcon = (slug: string): LucideIcon => CATEGORY[slug] ?? LayoutGrid;

/** Ícone ou logótipo de cada método de pagamento. */
export function MethodMark({ method, size = 44, active }: { method: string; size?: number; active?: boolean }) {
  if (["mpesa", "emola", "mkesh"].includes(method)) return <BrandMark slug={method} name={method} size={size} />;
  if (method === "cartao")
    return (
      <View style={{ flexDirection: "row", gap: 4 }}>
        <BrandMark slug="visa" name="Visa" size={size} />
        <BrandMark slug="mastercard" name="Mastercard" size={size} />
      </View>
    );
  const I = method === "qr" ? QrCode : method === "referencia_bancaria" ? Landmark : CreditCard;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: active ? "rgba(255,255,255,0.15)" : C.canvas, alignItems: "center", justifyContent: "center" }}>
      <I size={size * 0.45} color={active ? C.white : C.ink} />
    </View>
  );
}
