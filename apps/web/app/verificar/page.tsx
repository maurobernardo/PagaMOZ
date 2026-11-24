"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, PageTitle } from "@/components/ui";
import { VerificationResult, type Verification } from "@/components/verification-result";
import { csrfToken } from "@/lib/api";

export default function Verificar() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function checkFile(file: File) {
    setError("");
    setResult(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await fetch("/api/receipts/verify", { method: "POST", body: fd, headers: { "X-CSRFToken": csrfToken() } });
      const body = await res.json();
      if (res.ok) setResult(body);
      else setError(body.mensagem ?? body.detail ?? "Não foi possível verificar.");
    } catch {
      setError("Sem ligação. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle sub="Confirme se um comprovativo PagaMOZ é verdadeiro e se o pagamento continua válido.">
        Verificar comprovativo
      </PageTitle>

      <Card>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.toUpperCase().replace(/[\s-]/g, "");
            if (!/^[2-9A-HJKMNP-Z]{10}$/.test(c)) return setError("O código tem 10 caracteres (ex.: 7KQ2M-XH4RT).");
            router.push(`/verificar/${c}`);
          }}
        >
          <Field id="codigo" label="Código de verificação" placeholder="7KQ2M-XH4RT" autoCapitalize="characters"
            value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" disabled={!ready} className="w-full">Verificar código</Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-px flex-1 bg-slate-200" /> ou <span className="h-px flex-1 bg-slate-200" />
        </div>

        <label htmlFor="pdf" className="block text-sm font-medium text-slate-800">Carregar o PDF recebido</label>
        <input id="pdf" type="file" accept="application/pdf" disabled={!ready || busy}
          aria-describedby="pdf-hint"
          onChange={(e) => e.target.files?.[0] && checkFile(e.target.files[0])}
          className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-800" />
        <p id="pdf-hint" className="mt-1 text-sm text-slate-600">
          Detecta qualquer alteração ao ficheiro, mesmo de um só carácter.
        </p>
      </Card>

      <div className="mt-6">
        {busy ? <p role="status" className="text-slate-600">A verificar…</p> : null}
        {error ? <Alert>{error}</Alert> : null}
        {result ? <VerificationResult v={result} /> : null}
      </div>
    </div>
  );
}
