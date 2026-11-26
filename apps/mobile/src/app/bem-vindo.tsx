import { router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useRef, useState } from "react";
import { Animated, PanResponder, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark, LogoMark } from "../components/brand";
import { ONBOARDED, setItem } from "../lib/storage";
import { F } from "../theme";
import { t } from "../lib/i18n";

// Ecrã sempre escuro, nos dois temas.
const INK = "#0b0b0c";
const WHITE = "#ffffff";

async function start(to: "/cadastro" | "/cadastro?entrar=1") {
  await setItem(ONBOARDED, "1");
  router.replace(to);
}

/** Primeiro ecrã: o que é o PagaMOZ, com três comprovativos em leque e "deslize para começar". */
export default function BemVindo() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
      <Stripes />
      <LogoMark size={36} color={WHITE} />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: Math.min(width - 48, 320), height: 300 }}>
          <Receipt rotate="-14deg" x={-34} y={26} tone="#2a2a2c" org="adrmm" name="Fatura de água" amount="1 240,00" />
          <Receipt rotate="-5deg" x={-10} y={10} tone="#ededea" org="vodacom" name="Recarga de saldo" amount="200,00" dark={false} />
          <Receipt rotate="7deg" x={22} y={0} tone={WHITE} org="edm" name="Credelec" amount="500,00" dark={false} front />
        </View>
      </View>

      <View style={{ gap: 14 }}>
        <Text style={{ fontFamily: F.light, fontSize: 36, lineHeight: 42, letterSpacing: -1.2, color: WHITE, textAlign: "center" }}>
          Pague tudo{"\n"}sem ir ao balcão
        </Text>
        <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.65)", textAlign: "center" }}>
          {t("Luz, água, recargas, impostos e documentos. O dinheiro vai direito para a instituição e recebe comprovativo na hora.")}
        </Text>
        <View style={{ height: 10 }} />
        <SwipeToStart onDone={() => start("/cadastro")} />
        <Pressable accessibilityRole="button" onPress={() => start("/cadastro?entrar=1")} style={{ alignSelf: "center", padding: 8 }}>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
            {t("Já tem conta?")} <Text style={{ fontFamily: F.bold, color: WHITE }}>{t("Entrar")}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Riscas verticais discretas no fundo (como a primeira referência). */
function Stripes() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" }}>
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={{ flex: 1, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.045)" }} />
      ))}
    </View>
  );
}

function Receipt({ rotate, x, y, tone, org, name, amount, dark = true, front }: { rotate: string; x: number; y: number; tone: string; org: string; name: string; amount: string; dark?: boolean; front?: boolean }) {
  const fg = dark ? WHITE : INK;
  const sub = dark ? "rgba(255,255,255,0.55)" : "#6e6e6a";
  return (
    <View style={{
      position: "absolute", left: "50%", top: 20, width: 210, height: 270, marginLeft: -105 + x, marginTop: y,
      transform: [{ rotate }], backgroundColor: tone, borderRadius: 26, padding: 18, justifyContent: "space-between",
      borderWidth: 1, borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
      shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: front ? 16 : 8,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <BrandMark slug={org} name={name} size={40} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: dark ? "rgba(255,255,255,0.1)" : "#f4f4f1", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Check size={12} color={fg} strokeWidth={3} />
          <Text style={{ fontFamily: F.bold, fontSize: 11, color: fg }}>{t("Pago")}</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 13, color: sub }}>{name}</Text>
        <Text style={{ fontFamily: F.display, fontSize: 30, letterSpacing: -0.8, color: fg }}>{amount}<Text style={{ fontSize: 16 }}> MT</Text></Text>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ height: 1, backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#e9e8e3" }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: "monospace", fontSize: 11, color: sub }}>PMZ••••••7K2Q</Text>
          <Text style={{ fontFamily: F.bold, fontSize: 11, color: sub }}>{t("Comprovativo")}</Text>
        </View>
      </View>
    </View>
  );
}

/** Pílula "deslize para começar": arrastar até ao fim (ou tocar) entra na app. */
function SwipeToStart({ onDone }: { onDone: () => void }) {
  const [w, setW] = useState(0);
  const knob = 56;
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, w - knob - 8);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(g.dx, maxRef.current))),
    onPanResponderRelease: (_, g) => {
      if (g.dx > maxRef.current * 0.7) Animated.timing(x, { toValue: maxRef.current, duration: 140, useNativeDriver: false }).start(onDone);
      else Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
    },
  })).current;
  const maxRef = useRef(max);
  maxRef.current = max;
  const fade = x.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [1, 0] });

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityRole="button" accessibilityLabel={t("Começar")} onAccessibilityTap={onDone}
      style={{ height: knob + 8, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", justifyContent: "center", padding: 4 }}>
      <Animated.Text style={{ position: "absolute", alignSelf: "center", fontFamily: F.bold, fontSize: 16, color: WHITE, opacity: fade }}>{t("Deslize para começar")}</Animated.Text>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        <Pressable onPress={onDone} style={{ width: knob, height: knob, borderRadius: knob / 2, backgroundColor: WHITE, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>
          <ChevronRight size={18} color={INK} style={{ marginRight: -10, opacity: 0.35 }} />
          <ChevronRight size={18} color={INK} style={{ marginRight: -10, opacity: 0.65 }} />
          <ChevronRight size={18} color={INK} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
