// ponytail: um só idioma por agora; trocar por next-intl quando entrar o 2.º idioma.
export const locale = "pt-MZ";
export const timeZone = "Africa/Maputo";

export const formatMZN = (centavos: number) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "MZN" }).format(centavos / 100);

export const formatDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(d));
