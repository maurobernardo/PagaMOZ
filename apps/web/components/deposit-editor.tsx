"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card } from "@/components/ui";
import { csrfToken } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";

type Svc = {
  id: number; name: string; pricing: string; amount: number | null;
  deposit_bank: string; deposit_account: string; deposit_holder: string;
  commission_bps: number | null; commission_fixed: number | null; commission_payer: string;
};

const input = "min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm";

/**
 * Super admin: para cada serviço, a conta onde o parceiro deposita (banco, NIB, titular) e a comissão.
 * Só a plataforma muda a conta: mudá-la desviaria o dinheiro. Confirmar sempre com a instituição, por escrito.
 */
export function DepositEditor({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Svc[] | null>(null);

  useEffect(() => {
    fetch(`/api/backoffice/institutions/${slug}/services`).then(async (r) => setRows(r.ok ? await r.json() : []));
  }, [slug]);

  const set = (id: number, patch: Partial<Svc>) => setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function save(r: Svc) {
    const res = await fetch(`/api/backoffice/institutions/${slug}/services`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
      body: JSON.stringify({
        id: r.id, deposit_bank: r.deposit_bank.trim(), deposit_account: r.deposit_account.trim(), deposit_holder: r.deposit_holder.trim(),
        commission_bps: r.commission_bps, commission_fixed: r.commission_fixed, commission_payer: r.commission_payer,
      }),
    });
    const b = await res.json().catch(() => ({}));
    if (res.ok) toast(`${r.name}: guardado.`);
    else toast(String(Object.values(b).flat()[0] ?? "Não foi possível guardar."), "bad");
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold">Contas de depósito e comissões · {name}</p>
          <p className="mt-1 text-sm text-muted">Com conta preenchida, o serviço passa a depósito: o comprovativo serve de talão. Confirme a conta com a instituição por escrito.</p>
        </div>
        <button className="min-h-10 px-3 text-sm text-muted hover:text-ink" onClick={onClose}>Fechar</button>
      </div>
      {!rows ? <p className="mt-4 text-sm text-muted">A carregar…</p> : (
        <ul className="mt-4 space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line p-4">
              <p className="font-semibold">{r.name} <span className="text-sm font-normal text-muted">{r.amount ? `· ${formatMZN(r.amount)}` : "· valor variável"}</span></p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-xs font-semibold">Banco<input className={input} value={r.deposit_bank} placeholder="Ex.: BCI" onChange={(e) => set(r.id, { deposit_bank: e.target.value })} /></label>
                <label className="grid gap-1.5 text-xs font-semibold">Conta / NIB<input className={input} inputMode="numeric" value={r.deposit_account} onChange={(e) => set(r.id, { deposit_account: e.target.value })} /></label>
                <label className="grid gap-1.5 text-xs font-semibold">Titular da conta<input className={input} value={r.deposit_holder} onChange={(e) => set(r.id, { deposit_holder: e.target.value })} /></label>
                <label className="grid gap-1.5 text-xs font-semibold">Comissão fixa (MT)
                  <input className={input} inputMode="decimal" value={r.commission_fixed == null ? "" : r.commission_fixed / 100}
                    onChange={(e) => set(r.id, { commission_fixed: e.target.value === "" ? null : Math.round(Number(e.target.value.replace(",", ".")) * 100) })} />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold">Comissão % (100 = 1%)
                  <input className={input} inputMode="numeric" value={r.commission_bps ?? ""} onChange={(e) => set(r.id, { commission_bps: e.target.value === "" ? null : Number(e.target.value) })} />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold">Quem paga a comissão
                  <select className={input} value={r.commission_payer} onChange={(e) => set(r.id, { commission_payer: e.target.value })}>
                    <option value="">Como na instituição</option>
                    <option value="cidadao">Cidadão (à parte, mostrada antes de pagar)</option>
                    <option value="instituicao">Instituição (descontada do valor)</option>
                  </select>
                </label>
              </div>
              <Button className="mt-3 min-h-10" onClick={() => save(r)}>Guardar</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
