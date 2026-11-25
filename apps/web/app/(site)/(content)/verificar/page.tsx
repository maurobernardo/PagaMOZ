"use client";

import { FileSearch, FileUp, Hash, QrCode, ScanLine, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { Alert, Button, Skeleton } from "@/components/ui";
import { VerificationResult, type Verification } from "@/components/verification-result";
import { csrfToken } from "@/lib/api";

export default function Verificar() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function checkFile(f: File) {
    setError("");
    setResult(null);
    setBusy(true);
    setFile(f.name);
    const fd = new FormData();
    fd.set("file", f);
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
    <div className="mx-auto max-w-5xl">
      <section className="rounded-[2rem] bg-ink px-6 py-10 text-white sm:px-12 sm:py-14">
        <Eyebrow dark icon={ShieldCheck}>Autenticidade</Eyebrow>
        <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-5xl">Verificar comprovativo</h1>
        <p className="mt-3 max-w-xl text-white/60">Confirme se um comprovativo PagaMOZ é verdadeiro e se o pagamento continua válido. Não é preciso conta.</p>
        <ol className="mt-8 grid gap-2 sm:grid-cols-3">
          {[
            [QrCode, "Leia o QR do comprovativo ou copie o código"],
            [ScanLine, "Ou carregue o PDF recebido"],
            [ShieldCheck, "Vemos se é autêntico e se o pagamento é válido"],
          ].map(([I, t], i) => {
            const Icon = I as typeof QrCode;
            return (
              <li key={i} className="glass-dark flex items-center gap-3 rounded-2xl p-4 text-sm text-white/80">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-ink"><Icon className="h-4 w-4" /></span>
                {String(t)}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <form className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.toUpperCase().replace(/[\s-]/g, "");
            if (!/^[2-9A-HJKMNP-Z]{10}$/.test(c)) return setError("O código tem 10 caracteres (ex.: 7KQ2M-XH4RT).");
            router.push(`/verificar/${c}`);
          }}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas"><Hash className="h-5 w-5" /></span>
          <h2 className="mt-5 text-2xl font-bold">Pelo código</h2>
          <p className="mt-1 text-sm text-muted">Está impresso no comprovativo, ao lado do QR.</p>
          <label htmlFor="codigo" className="mt-6 block text-sm font-semibold">Código de verificação</label>
          <input id="codigo" placeholder="7KQ2M-XH4RT" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)}
            className="mt-1.5 block min-h-14 w-full rounded-2xl border border-line bg-white px-4 text-center font-mono text-xl uppercase tracking-[0.25em] placeholder:tracking-[0.25em] placeholder:text-line focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
          <div className="mt-auto pt-6"><Button type="submit" disabled={!ready} className="w-full !min-h-12"><FileSearch className="h-4 w-4" /> Verificar código</Button></div>
        </form>

        <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas"><FileUp className="h-5 w-5" /></span>
          <h2 className="mt-5 text-2xl font-bold">Pelo ficheiro</h2>
          <p className="mt-1 text-sm text-muted">Detecta qualquer alteração ao PDF, mesmo de um só carácter.</p>
          <label htmlFor="pdf"
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) checkFile(f); }}
            className={`mt-6 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition ${drag ? "border-ink bg-canvas" : "border-ink/15 hover:border-ink/40"}`}>
            <FileUp className="h-8 w-8 text-muted" />
            <span className="mt-3 font-semibold">{file || "Arraste o PDF para aqui"}</span>
            <span className="text-sm text-muted">ou toque para escolher</span>
            <span className="sr-only">Carregar o PDF recebido</span>
          </label>
          <input id="pdf" type="file" accept="application/pdf" disabled={!ready || busy} className="sr-only" aria-label="Carregar o PDF recebido"
            onChange={(e) => e.target.files?.[0] && checkFile(e.target.files[0])} />
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-xl">
        {busy ? <Skeleton className="h-48" /> : null}
        {error ? <Alert>{error}</Alert> : null}
        {result ? <VerificationResult v={result} /> : null}
      </div>
    </div>
  );
}
