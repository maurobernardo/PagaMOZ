"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { EN } from "@/lib/en";

/*
  Tema e idioma da web, guardados no browser.
  ponytail: a tradução troca o texto já desenhado (frase PT exacta -> EN) em vez de passar t() a cada página;
  frase nova sem entrada em lib/en.ts fica em português. Trocar por next-intl se o site crescer muito.
*/

const ORIGINAL = new WeakMap<Node, string>();
const ATTRS = ["placeholder", "aria-label", "title"] as const;

function translate(root: Node, en: boolean) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const orig = ORIGINAL.get(n) ?? n.nodeValue ?? "";
    const key = orig.trim();
    if (!key || !(key in EN)) continue;
    ORIGINAL.set(n, orig);
    const next = en ? orig.replace(key, EN[key]) : orig;
    if (n.nodeValue !== next) n.nodeValue = next;
  }
  if (root instanceof Element || root instanceof Document) {
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => {
      for (const a of ATTRS) {
        const store = `data-pt-${a}`;
        const orig = el.getAttribute(store) ?? el.getAttribute(a);
        if (!orig || !(orig.trim() in EN)) continue;
        el.setAttribute(store, orig);
        const next = en ? EN[orig.trim()] : orig;
        if (el.getAttribute(a) !== next) el.setAttribute(a, next);
      }
    });
  }
}

function read(k: string) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function write(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* sem armazenamento: vale só nesta visita */ }
}

/** Tradutor global (vai no layout raiz): corre em todas as páginas, com ou sem barra de topo. */
export function Translator() {
  const [lang, setLang] = useState<"pt" | "en">("pt");
  useEffect(() => {
    const sync = () => setLang(read("lang") === "en" ? "en" : "pt");
    sync();
    window.addEventListener("pagamoz:lang", sync);
    return () => window.removeEventListener("pagamoz:lang", sync);
  }, []);

  useEffect(() => {
    const en = lang === "en";
    document.documentElement.lang = en ? "en" : "pt-MZ";
    translate(document.body, en);
    if (!en) return;
    const obs = new MutationObserver((ms) => ms.forEach((m) => {
      if (m.type === "characterData") translate(m.target.parentNode ?? m.target, true);
      m.addedNodes.forEach((n) => translate(n, true));
    }));
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [lang]);
  return null;
}

/** Botões de tema e idioma (vão na barra de navegação). */
export function Prefs({ dark: onDark = false }: { dark?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<"pt" | "en">("pt");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    setLang(read("lang") === "en" ? "en" : "pt");
  }, []);
  const btn = `frame-none grid h-10 w-10 place-items-center rounded-full transition ${onDark ? "text-white/80 hover:bg-white/10" : "text-ink/70 hover:bg-ink/5"}`;
  return (
    <>
      <button type="button" className={btn} aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
        onClick={() => {
          const t = theme === "dark" ? "light" : "dark";
          setTheme(t);
          document.documentElement.dataset.theme = t;
          write("theme", t);
        }}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <button type="button" className={`${btn} w-auto px-3 text-xs font-bold`} aria-label="Mudar idioma"
        onClick={() => {
          const l = lang === "en" ? "pt" : "en";
          setLang(l);
          write("lang", l);
          window.dispatchEvent(new Event("pagamoz:lang"));
        }}>
        <Languages className="mr-1 h-4 w-4" />{lang === "en" ? "PT" : "EN"}
      </button>
    </>
  );
}

