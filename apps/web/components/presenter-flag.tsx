"use client";

import { useEffect } from "react";

/** ?apresentador=1 em qualquer página activa o modo apresentador nesta sessão do browser (cenários do simulador). */
export function PresenterFlag() {
  useEffect(() => {
    try {
      const v = new URLSearchParams(location.search).get("apresentador");
      if (v === "1") sessionStorage.setItem("pagamoz-apresentador", "1");
      if (v === "0") sessionStorage.removeItem("pagamoz-apresentador");
    } catch {
      /* armazenamento indisponível: modo apresentador fica desligado */
    }
  }, []);
  return null;
}
