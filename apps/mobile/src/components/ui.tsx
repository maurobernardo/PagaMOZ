import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { C, F, R } from "../theme";

export function H1({ children, light }: { children: ReactNode; light?: boolean }) {
  return <Text style={{ fontFamily: F.display, fontSize: 32, lineHeight: 36, color: light ? C.white : C.ink, letterSpacing: -0.6 }}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: F.display, fontSize: 22, lineHeight: 27, color: C.ink, letterSpacing: -0.3 }}>{children}</Text>;
}

export function P({ children, muted, light, size = 15, style }: { children: ReactNode; muted?: boolean; light?: boolean; size?: number; style?: object }) {
  return <Text style={[{ fontFamily: F.body, fontSize: size, lineHeight: size * 1.45, color: light ? "rgba(255,255,255,0.7)" : muted ? C.muted : C.ink }, style]}>{children}</Text>;
}

/** Etiqueta com ícone (equivalente ao Eyebrow da web). */
export function Eyebrow({ icon: Icon, children, dark }: { icon: LucideIcon; children: ReactNode; dark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: dark ? "rgba(255,255,255,0.1)" : C.white, borderWidth: 1, borderColor: dark ? "rgba(255,255,255,0.12)" : C.line }}>
      <Icon size={14} color={C.accent} />
      <Text style={{ fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: dark ? C.white : C.ink }}>{children}</Text>
    </View>
  );
}

export function Card({ children, style, dark }: { children: ReactNode; style?: ViewStyle; dark?: boolean }) {
  return <View style={[{ backgroundColor: dark ? C.ink : C.white, borderRadius: R.card, padding: 20, borderWidth: dark ? 0 : 1, borderColor: C.line }, style]}>{children}</View>;
}

type BtnProps = { children: ReactNode; onPress?: () => void; variant?: "primary" | "secondary" | "light" | "ghost"; disabled?: boolean; busy?: boolean; icon?: LucideIcon; style?: ViewStyle };

/** Botão dentro de um anel translúcido, como na web (.frame). */
export function Button({ children, onPress, variant = "primary", disabled, busy, icon: Icon, style }: BtnProps) {
  const bg = { primary: C.ink, secondary: C.white, light: C.white, ghost: "transparent" }[variant];
  const fg = variant === "primary" ? C.white : C.ink;
  return (
    <View style={[{ padding: variant === "ghost" ? 0 : 4, borderRadius: R.pill, backgroundColor: variant === "light" ? "rgba(255,255,255,0.14)" : "rgba(11,11,12,0.06)" }, style]}>
      <Pressable accessibilityRole="button" disabled={disabled || busy}
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
        style={({ pressed }) => ({ minHeight: 52, borderRadius: R.pill, backgroundColor: bg, borderWidth: variant === "secondary" ? 1 : 0, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        {busy ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} /> : null}
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: fg }}>{children}</Text>
      </Pressable>
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string; mono?: boolean };

export function Field({ label, hint, error, mono, style, ...input }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>{label}</Text>
      <TextInput placeholderTextColor="#b5b4ae" accessibilityLabel={label}
        style={[{ minHeight: 56, borderRadius: R.field, borderWidth: 1.5, borderColor: error ? C.accent : C.line, backgroundColor: C.white, paddingHorizontal: 16, fontFamily: mono ? "monospace" : F.semi, fontSize: 18, color: C.ink }, style]} {...input} />
      {error ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.accent }}>{error}</Text> : hint ? <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{hint}</Text> : null}
    </View>
  );
}

export function Alert({ children, tone = "bad" }: { children: ReactNode; tone?: "bad" | "info" | "ok" }) {
  const bg = { bad: C.accentSoft, info: C.canvas, ok: C.okSoft }[tone];
  const fg = { bad: C.accent, info: C.ink, ok: C.ok }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 18, padding: 14 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: fg }}>{children}</Text>
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
      <Text style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: "right", fontFamily: strong ? F.display : F.semi, fontSize: strong ? 18 : 14, color: C.ink }}>{value}</Text>
    </View>
  );
}

/** Passos numerados: 1. Dados  2. Confirmar  3. Pagar */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel={`Passo ${current + 1} de ${steps.length}`}>
      {steps.map((s, i) => (
        <View key={s} style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= current ? C.ink : C.line }} />
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: i <= current ? C.ink : C.muted }}>{i + 1}. {s}</Text>
        </View>
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
      <ActivityIndicator color={C.ink} size="large" />
    </View>
  );
}
