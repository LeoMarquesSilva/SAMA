"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Library,
  List,
  Search,
  X,
} from "lucide-react";
import { ManualMarkdown } from "@/components/ajuda/ManualMarkdown";
import {
  cleanManualTitle,
  type FaqItem,
  type GlossaryItem,
  type ManualSection,
  type ManualTocItem,
} from "@/lib/ajuda/parse-manual";

type Tab = "manual" | "faq" | "glossario";

const ATALHOS = [
  { label: "Classificar reunião", id: "classificar-um-compromisso-registrar-como-reuniao" },
  { label: "Sincronizar Outlook", id: "calendario-seu-fluxo-principal-sincronizar-com-o-outlook" },
  { label: "Desfazer classificação", id: "classificar-um-compromisso-desfazer-a-classificacao" },
  { label: "Próximos passos", id: "proximos-passos" },
];

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function AjudaClient({
  intro,
  sections,
  toc,
  faq,
  glossary,
}: {
  intro: string;
  sections: ManualSection[];
  toc: ManualTocItem[];
  faq: FaqItem[];
  glossary: GlossaryItem[];
}) {
  const [tab, setTab] = useState<Tab>("manual");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeId, setActiveId] = useState("intro");
  const [mobileIndex, setMobileIndex] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id))
  );

  const q = normalize(search.trim());

  const filteredToc = useMemo(() => {
    if (!q) return toc;
    return toc.filter(
      (item) =>
        normalize(item.title).includes(q) || item.keywords.includes(q)
    );
  }, [toc, q]);

  const filteredFaq = useMemo(() => {
    if (!q) return faq.map((item, i) => ({ item, i }));
    return faq
      .map((item, i) => ({ item, i }))
      .filter(
        ({ item }) =>
          normalize(item.question).includes(q) ||
          normalize(item.answer).includes(q)
      );
  }, [faq, q]);

  const filteredGlossary = useMemo(() => {
    if (!q) return glossary;
    return glossary.filter(
      (g) =>
        normalize(g.term).includes(q) || normalize(g.meaning).includes(q)
    );
  }, [glossary, q]);

  const filteredSections = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((section) => {
        const sectionMatch =
          normalize(section.title).includes(q) ||
          normalize(section.preamble).includes(q);
        const subs = section.subsections.filter(
          (sub) =>
            normalize(sub.title).includes(q) || normalize(sub.body).includes(q)
        );
        if (sectionMatch || subs.length) {
          return { ...section, subsections: sectionMatch ? section.subsections : subs };
        }
        return null;
      })
      .filter(Boolean) as ManualSection[];
  }, [sections, q]);

  function scrollTo(id: string) {
    setTab("manual");
    setActiveId(id);
    setMobileIndex(false);
    const el = document.getElementById(`ajuda-${id}`);
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (tab !== "manual") return;

    const ids = ["intro", ...sections.flatMap((s) => [s.id, ...s.subsections.map((sub) => sub.id)])];
    const elements = ids
      .map((id) => document.getElementById(`ajuda-${id}`))
      .filter(Boolean) as HTMLElement[];

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id.replace(/^ajuda-/, "");
        if (top) setActiveId(top);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [tab, sections, filteredSections]);

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "manual", label: "Manual", icon: BookOpen },
    { id: "faq", label: "Perguntas frequentes", icon: HelpCircle },
    { id: "glossario", label: "Glossário", icon: Library },
  ];

  function TocNav({ className }: { className?: string }) {
    const bySection = new Map<string, ManualTocItem[]>();
    for (const item of filteredToc) {
      if (item.level === 1 && item.id !== "intro") {
        if (!bySection.has(item.id)) bySection.set(item.id, []);
      }
    }
    for (const item of filteredToc) {
      if (item.level === 2 && item.sectionId) {
        const list = bySection.get(item.sectionId) ?? [];
        list.push(item);
        bySection.set(item.sectionId, list);
      }
    }

    return (
      <nav className={className}>
        <ul className="space-y-0.5 text-sm">
          {filteredToc.some((t) => t.id === "intro") && (
            <li>
              <button
                type="button"
                onClick={() => scrollTo("intro")}
                className={clsx(
                  "w-full rounded-lg px-2 py-1.5 text-left leading-snug transition",
                  activeId === "intro"
                    ? "bg-brand-50 font-medium text-brand-800"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Sobre este guia
              </button>
            </li>
          )}

          {sections
            .filter((s) =>
              filteredToc.some((t) => t.id === s.id || t.sectionId === s.id)
            )
            .map((section) => {
              const subs = bySection.get(section.id) ?? [];
              const open = expandedSections.has(section.id) || Boolean(q);
              const sectionTitle = cleanManualTitle(section.title);

              if (!filteredToc.some((t) => t.id === section.id) && !subs.length) {
                return null;
              }

              return (
                <li key={section.id} className="mt-1">
                  <div className="flex items-start gap-0.5">
                    {subs.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="mt-1 rounded p-0.5 text-slate-400 hover:bg-slate-100"
                        aria-label={open ? "Recolher" : "Expandir"}
                      >
                        {open ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => scrollTo(section.id)}
                      className={clsx(
                        "min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left font-medium leading-snug transition",
                        activeId === section.id
                          ? "bg-brand-50 text-brand-800"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {sectionTitle}
                    </button>
                  </div>
                  {open && subs.length > 0 && (
                    <ul className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
                      {subs.map((sub) => (
                        <li key={sub.id}>
                          <button
                            type="button"
                            onClick={() => scrollTo(sub.id)}
                            className={clsx(
                              "w-full rounded-lg px-2 py-1 text-left text-[13px] leading-snug transition",
                              activeId === sub.id
                                ? "bg-brand-50 font-medium text-brand-800"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            )}
                          >
                            {sub.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
        </ul>
      </nav>
    );
  }

  const showManualToc = tab === "manual";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Central de ajuda
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Como usar o SAMA
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Tudo o que você precisa para organizar seu calendário, registrar
          reuniões e acompanhar combinações — em linguagem direta, sem jargão.
        </p>
      </header>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no manual, FAQ ou glossário…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm shadow-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Limpar busca"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!search && tab === "manual" && (
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => scrollTo(a.id)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition",
              tab === id
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
            )}
          >
            <Icon size={17} />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}

        {showManualToc && (
          <button
            type="button"
            onClick={() => setMobileIndex(true)}
            className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 lg:hidden"
          >
            <List size={16} />
            Índice
          </button>
        )}
      </div>

      {mobileIndex && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileIndex(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Índice do manual</h2>
              <button
                type="button"
                onClick={() => setMobileIndex(false)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <TocNav />
          </div>
        </div>
      )}

      <div
        className={clsx(
          "grid w-full gap-6",
          showManualToc
            ? "grid-cols-1 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]"
            : "grid-cols-1"
        )}
      >
        {showManualToc && (
          <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-4 flex max-h-[calc(100dvh-6rem)] flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-2 shrink-0 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Índice
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
                <TocNav />
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 w-full">
          {tab === "manual" && (
            <article className="w-full space-y-6">
              {filteredSections.length === 0 && !filteredToc.some((t) => t.id === "intro" && normalize(intro).includes(q)) ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Nenhum resultado para &ldquo;{search}&rdquo;. Tente outras
                  palavras ou veja o FAQ.
                </p>
              ) : (
                <>
                  {intro && (!q || normalize(intro).includes(q) || activeId === "intro") && (
                    <section
                      id="ajuda-intro"
                      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
                    >
                      <h2 className="mb-4 text-xl font-bold text-slate-900">
                        Sobre este guia
                      </h2>
                      <ManualMarkdown content={intro} />
                    </section>
                  )}

                  {filteredSections.map((section) => (
                    <section
                      key={section.id}
                      id={`ajuda-${section.id}`}
                      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
                    >
                      <h2 className="mb-4 text-xl font-bold text-slate-900">
                        {cleanManualTitle(section.title)}
                      </h2>

                      {section.preamble && (
                        <ManualMarkdown content={section.preamble} />
                      )}

                      <div className="mt-4 space-y-3">
                        {section.subsections.map((sub) => (
                          <details
                            key={sub.id}
                            id={`ajuda-${sub.id}`}
                            className="group scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 open:bg-white"
                            open={Boolean(q) || undefined}
                          >
                            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:content-none hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                              <span className="flex items-center gap-2">
                                <ChevronRight
                                  size={16}
                                  className="shrink-0 text-slate-400 transition group-open:rotate-90"
                                />
                                {sub.title}
                              </span>
                            </summary>
                            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                              <ManualMarkdown content={sub.body} />
                            </div>
                          </details>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
            </article>
          )}

          {tab === "faq" && (
            <div className="w-full space-y-3">
              {filteredFaq.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Nenhuma pergunta encontrada.
                </p>
              ) : (
                filteredFaq.map(({ item, i }) => {
                  const open = openFaq === i || Boolean(q);
                  return (
                    <div
                      key={item.question}
                      className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
                        aria-expanded={open}
                      >
                        <HelpCircle
                          size={18}
                          className="mt-0.5 shrink-0 text-brand-600"
                        />
                        <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-800 sm:text-base">
                          {item.question}
                        </span>
                        <ChevronDown
                          size={18}
                          className={clsx(
                            "mt-0.5 shrink-0 text-slate-400 transition",
                            open && "rotate-180"
                          )}
                        />
                      </button>
                      {open && (
                        <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">
                          <ManualMarkdown content={item.answer} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "glossario" && (
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Glossário
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Termos que aparecem no SAMA e neste guia.
                </p>
              </div>
              {filteredGlossary.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  Nenhum termo encontrado.
                </p>
              ) : (
                <dl className="divide-y divide-slate-100">
                  {filteredGlossary.map((item) => (
                    <div
                      key={item.term}
                      className="grid gap-1 px-4 py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4 sm:px-5"
                    >
                      <dt className="text-sm font-semibold text-slate-800">
                        {item.term}
                      </dt>
                      <dd className="text-sm leading-relaxed text-slate-600">
                        {item.meaning}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
