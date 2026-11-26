/** Logótipos disponíveis em /public/logos (ver LEIA-ME.md). Sem ficheiro, mostra as iniciais. */
const LOGOS: Record<string, string> = { at: "at.webp", cmm: "cmm.webp", adrmm: "adrmm.webp", emola: "emola.webp", hcm: "hcm.webp", inatter: "inatter.webp", mkesh: "mkesh.webp", senami: "senami.webp", dstv: "dstv.svg", edm: "edm.webp", emose: "emose.webp", inss: "inss.webp", mastercard: "mastercard.svg", movitel: "movitel.webp", mpesa: "mpesa.svg", tmcel: "tmcel.webp", tvcabo: "tvcabo.svg", uem: "uem.webp", visa: "visa.svg", vodacom: "vodacom.svg", zap: "zap.webp", "fipag": "fipag.webp", "gotv": "gotv.webp", "isctem": "isctem.webp", "isutc": "isutc.webp", "startimes": "startimes.webp", "ucm": "ucm.webp", "ujc": "ujc.webp", "up-maputo": "up-maputo.webp", "unizambeze": "unizambeze.webp", "cmb": "cmb.webp", "hcb": "hcb.webp", "hcn": "hcn.webp", "hollard": "hollard.webp", "cmcm": "cmcm.webp" };

export function hasLogo(slug: string) {
  return slug in LOGOS;
}

export function BrandMark({ slug, name, size = 48, className = "" }: { slug: string; name: string; size?: number; className?: string }) {
  const box = { width: size, height: size };
  const file = LOGOS[slug];
  if (file)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/logos/${file}`} alt={name} style={box} className={`shrink-0 rounded-xl bg-[#fff] object-contain p-1 ${className}`} />
    );
  const initials = name.replace(/\(.*?\)/g, "").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span aria-label={name} role="img" style={box}
      className={`grid shrink-0 place-items-center rounded-xl bg-ink font-display text-sm font-bold text-white ${className}`}>{initials}</span>
  );
}
