import { Search, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { ServiceCard } from "@/components/service-card";
import { Empty, Eyebrow } from "@/components/ui";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Serviços" };

export default async function Servicos({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string; page?: string }> }) {
  const { categoria, q, page } = await searchParams;
  const [cats, list] = await Promise.all([
    api.GET("/api/catalog/categories"),
    api.GET("/api/catalog/services", { params: { query: { category: categoria, q, page: page ? Number(page) : undefined } } }),
  ]);
  const categories = cats.data ?? [];
  const services = list.data?.results ?? [];
  const current = categories.find((c) => c.slug === categoria);

  return (
    <>
      <Eyebrow>Catálogo · {list.data?.count ?? 0} serviços</Eyebrow>
      <h1 className="mt-5 text-4xl font-bold sm:text-5xl">{current?.name ?? "Todos os serviços"}</h1>
      <p className="mt-3 max-w-2xl text-muted">{q ? `Resultados para “${q}”.` : current?.description ?? "Escolha o serviço, introduza os dados e pague em três passos."}</p>

      <form action="/servicos" role="search" className="mt-10 flex max-w-2xl items-center gap-2 rounded-full border border-line bg-white p-2 shadow-[var(--shadow-soft)] focus-within:border-ink">
        {categoria ? <input type="hidden" name="categoria" value={categoria} /> : null}
        <label htmlFor="q" className="sr-only">Pesquisar</label>
        <Search className="ml-3 h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Serviço ou instituição"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base focus:outline-none" />
        <button className="min-h-11 shrink-0 rounded-full bg-ink px-5 font-semibold text-white hover:bg-ink/85">Pesquisar</button>
      </form>

      <nav aria-label="Categorias" className="-mx-5 mt-8 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
        <ul className="flex gap-2 whitespace-nowrap">
          <Chip href="/servicos" active={!categoria}>Todas</Chip>
          {categories.map((c) => (
            <Chip key={c.slug} href={`/servicos?categoria=${c.slug}`} active={c.slug === categoria}>
              <CategoryIcon slug={c.slug} className="h-4 w-4" /> {c.name}
            </Chip>
          ))}
        </ul>
      </nav>

      <div className="mt-10">
        {services.length === 0 ? (
          <Empty icon={<SearchX className="h-5 w-5" />} title="Nenhum serviço encontrado.">Experimente outra palavra ou veja todas as categorias.</Empty>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => <ServiceCard key={s.id} s={s} />)}
          </ul>
        )}
      </div>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-ink text-white" : "glass text-ink/80 hover:text-ink"}`}>
        {children}
      </Link>
    </li>
  );
}
