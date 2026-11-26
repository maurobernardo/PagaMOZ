/**
 * Mesma identidade da web: preto, branco, papel e um único vermelho de destaque.
 * Modo escuro inverte tinta e papel. `hero` e `onHero` são sempre escuros/brancos (cartões de destaque).
 *
 * ponytail: `C` é mutável e a app remonta-se ao mudar de tema (ver _layout). Trocar por contexto
 * se algum dia o remontar custar estado que importe.
 */
const LIGHT = {
  ink: "#0b0b0c",
  canvas: "#f4f4f1",
  white: "#ffffff",
  surface: "#ffffff",
  line: "#e9e8e3",
  muted: "#6e6e6a",
  soft: "#f0efea",
  accent: "#e0262f",
  accentSoft: "#fdecec",
  ok: "#127a3e",
  okSoft: "#e7f5ec",
  wait: "#8a5a00",
  waitSoft: "#fdf3dc",
  hero: "#0b0b0c",
  heroCard: "#18181a",
  onHero: "#ffffff",
  shadow: "#000000",
};

const DARK: typeof LIGHT = {
  ink: "#f4f4f1",
  canvas: "#0b0b0c",
  white: "#0b0b0c",
  surface: "#161618",
  line: "#26262a",
  muted: "#9a9a95",
  soft: "#1f1f22",
  accent: "#ff4d55",
  accentSoft: "#2a1214",
  ok: "#4cc27e",
  okSoft: "#10251a",
  wait: "#f2b94b",
  waitSoft: "#2a210c",
  hero: "#18181a",
  heroCard: "#232326",
  onHero: "#ffffff",
  shadow: "#000000",
};

export const C = { ...LIGHT };
export let isDark = false;

export function applyScheme(dark: boolean) {
  isDark = dark;
  Object.assign(C, dark ? DARK : LIGHT);
}

/** Inter em toda a app (como na referência dos cartões): títulos leves e grandes, texto limpo. */
export const F = {
  display: "Inter_600SemiBold",
  displayX: "Inter_700Bold",
  light: "Inter_300Light",
  body: "Inter_400Regular",
  semi: "Inter_500Medium",
  bold: "Inter_600SemiBold",
};

export const R = { card: 24, field: 18, pill: 999 };

/** Sombra suave dos cartões (como nas referências). */
export const shadow = () => ({
  shadowColor: C.shadow,
  shadowOpacity: isDark ? 0 : 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: isDark ? 0 : 2,
});
