"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Briefcase,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GrupoEmpresasModal } from "@/components/clientes/GrupoEmpresasModal";
import {
  obterCiEmpresaUnicaDoGrupo,
} from "@/app/(app)/clientes/actions";
import { labelGrupoCliente } from "@/lib/clientes";
import type { GrupoClienteResumo } from "@/types/database";

export function ClientesClient({
  grupos,
  total,
  pagina,
  porPagina,
  q,
}: {
  grupos: GrupoClienteResumo[];
  total: number;
  pagina: number;
  porPagina: number;
  q: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(q);
  const [modalGrupo, setModalGrupo] = useState<GrupoClienteResumo | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (busca.trim() !== q) {
        const params = new URLSearchParams();
        if (busca.trim()) params.set("q", busca.trim());
        router.push(`/clientes?${params.toString()}`);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [busca, q, router]);

  function irPagina(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("pagina", String(p));
    router.push(`/clientes?${params.toString()}`);
  }

  async function onGrupoClick(grupo: GrupoClienteResumo) {
    if (grupo.total_empresas <= 0) return;

    if (grupo.total_empresas === 1) {
      setAbrindo(grupo.grupo_cliente);
      try {
        const ci = await obterCiEmpresaUnicaDoGrupo(grupo.grupo_cliente);
        if (ci) {
          router.push(`/clientes/${encodeURIComponent(ci)}`);
          return;
        }
      } finally {
        setAbrindo(null);
      }
    }

    setModalGrupo(grupo);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Clientes
          </h1>
          <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <RefreshCw size={13} />
            {total.toLocaleString("pt-BR")} grupos · dados do VIOS
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar grupo ou empresa..."
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          {q
            ? `Nenhum grupo encontrado para “${q}”.`
            : "Nenhum grupo sincronizado ainda."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {grupos.map((g) => {
              const nome = labelGrupoCliente(g.grupo_cliente);
              const isLoading = abrindo === g.grupo_cliente;
              const varias = g.total_empresas > 1;

              return (
                <button
                  key={g.grupo_cliente || "__sem_grupo__"}
                  type="button"
                  onClick={() => void onGrupoClick(g)}
                  disabled={isLoading || g.total_empresas <= 0}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-200 hover:shadow-sm disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Layers size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">
                        {nome}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="blue">
                          <span className="inline-flex items-center gap-1">
                            <Building2 size={12} />
                            {g.total_empresas}{" "}
                            {g.total_empresas === 1 ? "empresa" : "empresas"}
                          </span>
                        </Badge>
                        {g.total_geral > 0 && (
                          <Badge tone="gray">
                            <span className="inline-flex items-center gap-1">
                              <Briefcase size={12} />
                              {g.total_geral} processos
                            </span>
                          </Badge>
                        )}
                        {g.horas_total > 0 && (
                          <Badge tone="gray">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {g.horas_total.toLocaleString("pt-BR", {
                                maximumFractionDigits: 0,
                              })}
                              h
                            </span>
                          </Badge>
                        )}
                      </div>
                      {isLoading ? (
                        <p className="mt-2 text-xs text-slate-400">
                          Abrindo...
                        </p>
                      ) : varias ? (
                        <p className="mt-2 text-xs text-brand-600">
                          Clique para ver empresas
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">
                          Clique para ver detalhes
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Página {pagina} de {totalPaginas.toLocaleString("pt-BR")}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => irPagina(pagina - 1)}
                disabled={pagina <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <button
                type="button"
                onClick={() => irPagina(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      {modalGrupo && (
        <GrupoEmpresasModal
          open={!!modalGrupo}
          onClose={() => setModalGrupo(null)}
          grupoCliente={modalGrupo.grupo_cliente}
          grupoLabel={labelGrupoCliente(modalGrupo.grupo_cliente)}
        />
      )}
    </div>
  );
}
