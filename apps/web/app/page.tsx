import Link from "next/link";
import { Icon } from "@/components/icons";
import { TrackForm } from "@/components/track-form";
import { api } from "@/lib/api";

export const revalidate = 60;

export default async function Home() {
  const { data: categories = [] } = await api.GET("/api/catalog/categories").catch(() => ({ data: undefined }));
  return (
    <>
      <section className="-mx-4 -mt-6 bg-brand-900 px-4 pb-10 pt-8 text-white sm:-mt-10 sm:rounded-b-3xl sm:pb-14 sm:pt-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Pague serviços e taxas sem ir ao balcão.
          </h1>
          <p className="mt-3 text-lg text-brand-100">
            Água, energia, impostos, propinas, documentos e mais. Pague com M-Pesa, e‑Mola, mKesh ou cartão e
            receba um comprovativo verificável.
          </p>
          <form action="/servicos" className="mt-6 flex gap-2" role="search">
            <label htmlFor="q" className="sr-only">
              Pesquisar serviço
            </label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Ex.: fatura de água, multa, propina…"
              className="min-h-12 flex-1 rounded-xl border-0 bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-amber-300"
            />
            <button className="grid min-h-12 min-w-12 place-items-center rounded-xl bg-amber-300 px-4 font-semibold text-amber-950 hover:bg-amber-200">
              <Icon name="search" className="h-5 w-5" />
              <span className="sr-only">Pesquisar</span>
            </button>
          </form>
        </div>
      </section>

      <section aria-labelledby="cat-title" className="mt-8">
        <h2 id="cat-title" className="text-xl font-bold">
          O que quer pagar?
        </h2>
        {categories.length === 0 ? (
          <p className="mt-4 text-slate-600">Serviços indisponíveis de momento. Tente mais tarde.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/servicos?categoria=${c.slug}`}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-600 hover:shadow"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon name={c.icon} />
                  </span>
                  <span className="font-semibold leading-snug">{c.name}</span>
                  <span className="text-sm text-slate-600">{c.service_count} serviços</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="track-title" className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="track-title" className="text-lg font-bold">
          Acompanhar pagamento ou pedido
        </h2>
        <p className="mb-3 mt-1 text-sm text-slate-600">Use o código que recebeu (PMZ… ou PED…).</p>
        <TrackForm />
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["shield", "Dinheiro directo à instituição", "O pagamento é liquidado na conta da entidade. A plataforma não fica com os fundos."],
          ["check", "Comprovativo verificável", "Cada pagamento tem um código que qualquer pessoa pode verificar."],
          ["share", "Pague por outra pessoa", "Partilhe um link e a família, mesmo no estrangeiro, paga por si."],
        ].map(([icon, title, text]) => (
          <div key={title} className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icon} />
            </span>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
