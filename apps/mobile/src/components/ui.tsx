import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePrefs } from "../lib/prefs";
import { C, F, R, shadow } from "../theme";

const tap = (on: boolean) => { if (on) Haptics.selectionAsync().catch(() => {}); };

export function H1({ children, light }: { children: ReactNode; light?: boolean }) {
  return <Text style={{ fontFamily: F.display, fontSize: 30, lineHeight: 36, color: light ? C.onHero : C.ink, letterSpacing: -0.8 }}>{children}</Text>;
}

export function H2({ children, light }: { children: ReactNode; light?: boolean }) {
  return <Text style={{ fontFamily: F.display, fontSize: 19, lineHeight: 24, color: light ? C.onHero : C.ink, letterSpacing: -0.3 }}>{children}</Text>;
}

export function P({ children, muted, light, size = 15, style }: { children: ReactNode; muted?: boolean; light?: boolean; size?: number; style?: object }) {
  return <Text style={[{ fontFamily: F.body, fontSize: size, lineHeight: size * 1.45, color: light ? "rgba(255,255,255,0.68)" : muted ? C.muted : C.ink }, style]}>{children}</Text>;
}

/** Etiqueta pequena com ícone. */
export function Eyebrow({ icon: Icon, children, dark }: { icon: LucideIcon; children: ReactNode; dark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: R.pill, backgroundColor: dark ? "rgba(255,255,255,0.1)" : C.soft }}>
      <Icon size={13} color={dark ? C.onHero : C.ink} />
      <Text style={{ fontFamily: F.semi, fontSize: 12, color: dark ? C.onHero : C.ink }}>{children}</Text>
    </View>
  );
}

/** Botão redondo (voltar, acções do cabeçalho). Vidro líquido no iOS 26. */
export function RoundButton({ icon: Icon, onPress, label, dark }: { icon: LucideIcon; onPress: () => void; label: string; dark?: boolean }) {
  const inner = <Icon size={20} color={dark ? C.onHero : C.ink} />;
  const box = { width: 44, height: 44, borderRadius: 22, alignItems: "center" as const, justifyContent: "center" as const };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}>
      {Platform.OS === "ios" && isLiquidGlassAvailable() ? (
        <GlassView isInteractive style={box}>{inner}</GlassView>
      ) : (
        <View style={[box, dark ? { backgroundColor: "rgba(255,255,255,0.1)" } : { backgroundColor: C.surface, ...shadow() }]}>{inner}</View>
      )}
    </Pressable>
  );
}

/** Cabeçalho dos ecrãs interiores: voltar à esquerda, título ao centro, acção à direita. */
export function Header({ title, right, dark, back = true }: { title?: string; right?: ReactNode; dark?: boolean; back?: boolean }) {
  const top = useSafeAreaInsets().top;
  return (
    <View style={{ paddingTop: top + 6, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: dark ? C.hero : C.canvas }}>
      {back ? <RoundButton icon={ChevronLeft} label="Voltar" dark={dark} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : <View style={{ width: 44 }} />}
      <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: F.bold, fontSize: 16, color: dark ? C.onHero : C.ink }}>{title ?? ""}</Text>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

/** Título grande + subtítulo, como "Goal Tracker / Small steps…". */
export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: F.display, fontSize: 30, letterSpacing: -0.8, color: C.ink }}>{title}</Text>
      {sub ? <Text style={{ fontFamily: F.body, fontSize: 15, color: C.muted }}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style, dark }: { children: ReactNode; style?: ViewStyle; dark?: boolean }) {
  return <View style={[{ backgroundColor: dark ? C.heroCard : C.surface, borderRadius: R.card, padding: 18 }, dark ? null : shadow(), style]}>{children}</View>;
}

/** Escolha em pílulas ("Todos / Pagos / Pendentes"). */
export function Segmented<T extends string>({ options, value, onChange, dark }: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void; dark?: boolean }) {
  const { prefs } = usePrefs();
  return (
    <View style={{ flexDirection: "row", gap: 6, padding: 4, borderRadius: R.pill, backgroundColor: dark ? "rgba(255,255,255,0.08)" : C.soft }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(prefs.haptics); onChange(o.key); }}
            style={{ flex: 1, minHeight: 38, borderRadius: R.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, backgroundColor: on ? (dark ? C.onHero : C.ink) : "transparent" }}>
            <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 13, color: on ? (dark ? "#0b0b0c" : C.white) : dark ? "rgba(255,255,255,0.7)" : C.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pílulas que deslizam na horizontal (categorias). */
export function Pill({ label, active, onPress, icon: Icon }: { label: string; active: boolean; onPress: () => void; icon?: LucideIcon }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: active ? C.ink : C.surface, ...(active ? {} : shadow()) }}>
      {Icon ? <Icon size={15} color={active ? C.white : C.ink} /> : null}
      <Text style={{ fontFamily: F.semi, fontSize: 14, color: active ? C.white : C.ink }}>{label}</Text>
    </Pressable>
  );
}

type BtnProps = { children: ReactNode; onPress?: () => void; variant?: "primary" | "secondary" | "light" | "ghost" | "danger"; disabled?: boolean; busy?: boolean; icon?: LucideIcon; style?: ViewStyle };

export function Button({ children, onPress, variant = "primary", disabled, busy, icon: Icon, style }: BtnProps) {
  const { prefs } = usePrefs();
  const bg = { primary: C.ink, secondary: C.surface, light: C.onHero, ghost: "transparent", danger: C.accentSoft }[variant];
  const fg = { primary: C.white, secondary: C.ink, light: "#0b0b0c", ghost: C.ink, danger: C.accent }[variant];
  return (
    <Pressable accessibilityRole="button" disabled={disabled || busy}
      onPress={() => { tap(prefs.haptics); onPress?.(); }}
      style={({ pressed }) => [{ minHeight: 54, borderRadius: R.pill, backgroundColor: bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, variant === "secondary" ? shadow() : null, style]}>
      {busy ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: 16, color: fg }}>{children}</Text>
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string; mono?: boolean };

export function Field({ label, hint, error, mono, style, ...input }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{label}</Text>
      <TextInput placeholderTextColor={C.muted} accessibilityLabel={label} keyboardAppearance="default"
        style={[{ minHeight: 54, borderRadius: R.field, borderWidth: 1.5, borderColor: error ? C.accent : C.line, backgroundColor: C.surface, paddingHorizontal: 16, fontFamily: mono ? "monospace" : F.semi, fontSize: 17, color: C.ink }, style]} {...input} />
      {error ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.accent }}>{error}</Text> : hint ? <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{hint}</Text> : null}
    </View>
  );
}

export function Alert({ children, tone = "bad" }: { children: ReactNode; tone?: "bad" | "info" | "ok" }) {
  const bg = { bad: C.accentSoft, info: C.soft, ok: C.okSoft }[tone];
  const fg = { bad: C.accent, info: C.ink, ok: C.ok }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 18, padding: 14 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: fg }}>{children}</Text>
    </View>
  );
}

export function Row({ label, value, strong, dark }: { label: string; value: ReactNode; strong?: boolean; dark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderColor: dark ? "rgba(255,255,255,0.08)" : C.line }}>
      <Text style={{ fontFamily: F.body, fontSize: 14, color: dark ? "rgba(255,255,255,0.6)" : C.muted }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: "right", fontFamily: strong ? F.display : F.semi, fontSize: strong ? 18 : 14, color: dark ? C.onHero : C.ink }}>{value}</Text>
    </View>
  );
}

/** Linha de lista com ícone num círculo, título, subtítulo e o que estiver à direita. */
export function ListRow({ icon: Icon, iconBg, title, sub, right, onPress, first, danger }: {
  icon?: LucideIcon; iconBg?: string; title: string; sub?: string; right?: ReactNode; onPress?: () => void; first?: boolean; danger?: boolean;
}) {
  const { prefs } = usePrefs();
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={() => { tap(prefs.haptics); onPress?.(); }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderColor: C.line, backgroundColor: pressed ? C.soft : "transparent" })}>
      {Icon ? (
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: iconBg ?? (danger ? C.accentSoft : C.soft), alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={danger ? C.accent : C.ink} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 15, color: danger ? C.accent : C.ink }}>{title}</Text>
        {sub ? <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={C.muted} /> : null)}
    </Pressable>
  );
}

/** Grupo de linhas dentro de um cartão (estilo definições iOS / Material). */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.muted, marginLeft: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</Text> : null}
      <View style={{ backgroundColor: C.surface, borderRadius: R.card, overflow: "hidden", ...shadow() }}>{children}</View>
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: C.ink, false: C.line }} thumbColor={Platform.OS === "android" ? (value ? C.white : C.surface) : undefined} ios_backgroundColor={C.line} />;
}

/** Barra de progresso fina. */
export function Progress({ value, tone }: { value: number; tone?: string }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: C.soft, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: tone ?? C.ink }} />
    </View>
  );
}

/** Anel de progresso (ex.: 3/5 concluídos). */
export function Ring({ value, size = 120, children }: { value: number; size?: number; children?: ReactNode }) {
  const sw = 10;
  const r = (size - sw) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.soft} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.ink} strokeWidth={sw} fill="none" strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, value)))} />
      </Svg>
      {children}
    </View>
  );
}

/** Passos numerados: 1. Dados  2. Confirmar  3. Pagar */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel={`${current + 1}/${steps.length}`}>
      {steps.map((s, i) => (
        <View key={s} style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= current ? C.ink : C.line }} />
          <Text style={{ fontFamily: F.semi, fontSize: 12, color: i <= current ? C.ink : C.muted }}>{i + 1}. {s}</Text>
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
