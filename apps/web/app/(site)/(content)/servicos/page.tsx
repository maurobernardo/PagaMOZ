import { Building2, LayoutGrid, Search, SearchX, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { Eyebrow } from "@/components/eyebrow";
import { GroupCard, ServiceCard } from "@/components/service-card";
import { Empty } from "@/components/ui";
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
  const total = categories.reduce((a, c) => a + c.service_count, 0);
  const institutions = new Set(services.map((s) => s.institution.slug)).size;

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-10 text-white sm:px-12 sm:py-14">
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <Eyebrow dark icon={current ? Zap : LayoutGrid}>{current ? current.name : "Catálogo"}</Eyebrow>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl">{q ? `Resultados para “${q}”` : current?.name ?? "Todos os serviços"}</h1>
            <p className="mt-3 max-w-xl text-white/60">{current?.description ?? "Escolha o serviço, introduza os dados e pague em três passos."}</p>
            <form action="/servicos" role="search" className="glass-dark mt-8 flex max-w-xl items-center gap-2 rounded-full p-2">
              {categoria ? <input type="hidden" name="categoria" value={categoria} /> : null}
              <label htmlFor="q" className="sr-only">Pesquisar</label>
              <Search className="ml-3 h-5 w-5 shrink-0 text-white/50" aria-hidden />
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Serviço ou instituição"
                className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none" />
              <button className="frame-none min-h-11 shrink-0 rounded-full bg-white px-5 font-semibold text-ink hover:bg-white/90">Pesquisar</button>
            </form>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {[["Serviços", String(total)], ["Nesta lista", String(list.data?.count ?? 0)], ["Instituições", String(institutions)]].map(([l, v]) => (
              <div key={l} className="glass-dark rounded-2xl px-4 py-4">
                <dt className="text-xs text-white/50">{l}</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <nav aria-label="Categorias" className="-mx-5 mt-6 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
        <ul className="glass inline-flex gap-1.5 whitespace-nowrap rounded-full p-1.5">
          <Chip href="/servicos" active={!categoria && !q}><LayoutGrid className="h-4 w-4" /> Todas</Chip>
          {categories.map((c) => (
            <Chip key={c.slug} href={`/servicos?categoria=${c.slug}`} active={c.slug === categoria}>
              <CategoryIcon slug={c.slug} className="h-4 w-4" /> {c.name}
              <span className="rounded-full bg-ink/5 px-1.5 text-[11px]">{c.service_count}</span>
            </Chip>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        {services.length === 0 ? (
          <Empty icon={<SearchX className="h-5 w-5" />} title="Nenhum serviço encontrado.">Experimente outra palavra ou veja todas as categorias.</Empty>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              if (!s.group) return <ServiceCard key={s.id} s={s} />;
              if (services.find((x) => x.group?.key === s.group!.key) !== s) return null; // um cartão por assunto
              return <GroupCard key={s.group.key} s={s} options={services.filter((x) => x.group?.key === s.group!.key)} />;
            })}
          </ul>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-white p-6">
        <p className="flex items-center gap-3 text-sm text-muted"><Building2 className="h-5 w-5 text-ink" /> Representa uma instituição e quer receber pagamentos pelo PagaMOZ?</p>
        <div className="glass inline-flex rounded-full p-1.5">
          <Link href="/portal" className="inline-flex min-h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85">Portal das instituições</Link>
        </div>
      </div>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-ink text-white" : "text-ink/75 hover:bg-white hover:text-ink"}`}>
        {children}
      </Link>
    </li>
  );
}
