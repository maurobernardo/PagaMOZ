import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/service-card";
import { PageTitle } from "@/components/ui";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Serviços" };

export default async function Servicos({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; page?: string }>;
}) {
  const { categoria, q, page } = await searchParams;
  const [cats, list] = await Promise.all([
    api.GET("/api/catalog/categories"),
    api.GET("/api/catalog/services", {
      params: { query: { category: categoria, q, page: page ? Number(page) : undefined } },
    }),
  ]);
  const categories = cats.data ?? [];
  const services = list.data?.results ?? [];
  const current = categories.find((c) => c.slug === categoria);

  return (
    <>
      <PageTitle sub={q ? `Resultados para “${q}”` : current?.description}>{current?.name ?? "Todos os serviços"}</PageTitle>

      <form action="/servicos" role="search" className="mb-4 flex gap-2">
        {categoria ? <input type="hidden" name="categoria" value={categoria} /> : null}
        <label htmlFor="q" className="sr-only">
          Pesquisar
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Pesquisar serviço ou instituição"
          className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
        />
        <button className="min-h-12 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Pesquisar</button>
      </form>

      <nav aria-label="Categorias" className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-2 whitespace-nowrap">
          <Chip href="/servicos" active={!categoria}>
            Todas
          </Chip>
          {categories.map((c) => (
            <Chip key={c.slug} href={`/servicos?categoria=${c.slug}`} active={c.slug === categoria}>
              {c.name}
            </Chip>
          ))}
        </ul>
      </nav>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold">Nenhum serviço encontrado.</p>
          <p className="mt-1 text-sm text-slate-600">Experimente outra palavra ou veja todas as categorias.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} s={s} />
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset ${
          active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}
