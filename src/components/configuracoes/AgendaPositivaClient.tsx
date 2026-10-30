"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarCheck, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { salvarAgendaPositiva } from "@/app/(app)/configuracoes/actions";
import { buscarClientes } from "@/app/(app)/clientes/actions";
import {
  CLUSTERS_AGENDA,
  CLUSTER_CLASSES,
  META_MENSAL_MAX,
  type AgendaPositivaCliente,
  type ClusterAgenda,
} from "@/lib/agenda-positiva";

/** Linha em edição: meta como texto para o campo poder ficar vazio enquanto digita. */
type Linha = { grupo_cliente: string; cluster: ClusterAgenda; meta: string };

const CLUSTER_NOVO: ClusterAgenda = "B";

function paraLinhas(clientes: AgendaPositivaCliente[]): Linha[] {
  return clientes.map((c) => ({
    grupo_cliente: c.grupo_cliente,
    cluster: c.cluster,
    meta: String(c.meta_mensal),
  }));
}

function assinatura(linhas: Linha[]): string {
  return JSON.stringify(
    [...linhas]
      .map((l) => [l.grupo_cliente, l.cluster, l.meta.trim()])
      .sort((a, b) => a[0].localeCompare(b[0]))
  );
}

export function AgendaPositivaClient({
  clientes,
  semTabela,
  podeEditar,
  reunioes6m,
  sugestoes,
}: {
  clientes: AgendaPositivaCliente[];
  semTabela: boolean;
  podeEditar: boolean;
  /** Reuniões (não canceladas) de cada cliente nos últimos 6 meses. */
  reunioes6m: Record<string, number>;
  /** Clientes fora da agenda com mais reuniões nos últimos 6 meses. */
  sugestoes: { grupo_cliente: string; total: number }[];
}) {
  const router = useRouter();
  const { success, error: erroToast } = useToast();
  const [pending, start] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>(() => paraLinhas(clientes));
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState("");

  const original = useMemo(() => assinatura(paraLinhas(clientes)), [clientes]);
  const alterado = assinatura(linhas) !== original;
  const naLista = useMemo(() => new Set(linhas.map((l) => l.grupo_cliente)), [linhas]);

  useEffect(() => {
    setLinhas(paraLinhas(clientes));
    setNovos(new Set());
  }, [clientes]);

  const porCluster = CLUSTERS_AGENDA.map((c) => ({
    ...c,
    total: linhas.filter((l) => l.cluster === c.chave).length,
  }));

  const termo = filtro.trim().toLowerCase();
  const visiveis = termo
    ? linhas.filter((l) => l.grupo_cliente.toLowerCase().includes(termo))
    : linhas;

  function adicionar(grupo: string) {
    if (naLista.has(grupo)) return;
    setLinhas((atual) => [{ grupo_cliente: grupo, cluster: CLUSTER_NOVO, meta: "1" }, ...atual]);
    setNovos((atual) => new Set(atual).add(grupo));
    setFiltro("");
  }

  function alterar(grupo: string, patch: Partial<Linha>) {
    setLinhas((atual) =>
      atual.map((l) => (l.grupo_cliente === grupo ? { ...l, ...patch } : l))
    );
  }

  function remover(grupo: string) {
    setLinhas((atual) => atual.filter((l) => l.grupo_cliente !== grupo));
  }

  function salvar() {
    const semMeta = linhas.find((l) => !/^\d+$/.test(l.meta.trim()));
    if (semMeta) {
      erroToast(`Informe a meta mensal de ${semMeta.grupo_cliente}.`);
      return;
    }
    start(async () => {
      const r = await salvarAgendaPositiva(
        linhas.map((l) => ({
          grupo_cliente: l.grupo_cliente,
          cluster: l.cluster,
          meta_mensal: Number(l.meta),
        }))
      );
      if (!r.ok) {
        erroToast(r.error ?? "Não foi possível salvar.");
        return;
      }
      success("Agenda Positiva salva.");
      router.refresh();
    });
  }

  const sugestoesFora = sugestoes.filter((s) => !naLista.has(s.grupo_cliente));

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CalendarCheck size={16} className="text-brand-600" />
            Agenda Positiva por cliente
          </h2>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
            Para cada cliente, o cluster de prioridade e quantas reuniões ele deve
            ter por mês. O{" "}
            <Link href="/agenda-positiva" className="text-brand-700 hover:underline">
              Dashboard Agenda Positiva
            </Link>{" "}
            compara essa meta com as reuniões feitas. {linhas.length}{" "}
            {linhas.length === 1 ? "cliente" : "clientes"} na agenda
            {linhas.length > 0 &&
              ` (${porCluster.map((c) => `${c.total} no ${c.chave}`).join(", ")})`}
            .
          </p>
        </div>
        {podeEditar && (
          <div className="flex items-center gap-2">
            {alterado && !pending && (
              <span className="text-xs text-amber-700">Alterações não salvas</span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={salvar}
              disabled={pending || !alterado || semTabela}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </Button>
          </div>
        )}
      </div>

      {semTabela && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A tabela da Agenda Positiva ainda não existe no banco. Aplique a migration
          0057 para começar.
        </p>
      )}

      {!podeEditar && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Só administradores podem alterar a Agenda Positiva.
        </p>
      )}

      {podeEditar && !semTabela && (
        <div className="space-y-2">
          <BuscaGrupo naLista={naLista} onEscolher={adicionar} />
          {sugestoesFora.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">
                Mais reuniões nos últimos 6 meses, fora da agenda:
              </span>
              {sugestoesFora.slice(0, 12).map((s) => (
                <button
                  key={s.grupo_cliente}
                  type="button"
                  onClick={() => adicionar(s.grupo_cliente)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  title={`Adicionar ${s.grupo_cliente} à agenda`}
                >
                  <Plus size={12} />
                  {s.grupo_cliente}
                  <span className="tabular-nums text-slate-400">· {s.total}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {linhas.length > 8 && (
        <label className="relative block max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar clientes da agenda"
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      )}

      {linhas.length === 0 ? (
        !semTabela && (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            Nenhum cliente na agenda ainda.
            {podeEditar && " Busque um cliente acima ou use as sugestões."}
          </p>
        )
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {visiveis.map((l) => {
            const total6m = reunioes6m[l.grupo_cliente] ?? 0;
            return (
              <li
                key={l.grupo_cliente}
                className={clsx(
                  "flex flex-col gap-2 px-3 py-3 lg:flex-row lg:items-center lg:justify-between",
                  novos.has(l.grupo_cliente) && "bg-brand-50/50"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {l.grupo_cliente}
                  </p>
                  <p className="text-xs text-slate-500">
                    {total6m === 0
                      ? "Nenhuma reunião nos últimos 6 meses"
                      : `${total6m} ${total6m === 1 ? "reunião" : "reuniões"} nos últimos 6 meses · média de ${(total6m / 6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/mês`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                    role="radiogroup"
                    aria-label={`Cluster de ${l.grupo_cliente}`}
                  >
                    {CLUSTERS_AGENDA.map((c) => {
                      const ativo = l.cluster === c.chave;
                      return (
                        <button
                          key={c.chave}
                          type="button"
                          role="radio"
                          aria-checked={ativo}
                          disabled={!podeEditar || pending}
                          onClick={() => alterar(l.grupo_cliente, { cluster: c.chave })}
                          title={c.label}
                          className={clsx(
                            "rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:cursor-default",
                            ativo
                              ? CLUSTER_CLASSES[c.chave]
                              : "text-slate-500 hover:bg-white hover:text-slate-700"
                          )}
                        >
                          {c.curto}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Meta
                    <input
                      inputMode="numeric"
                      value={l.meta}
                      disabled={!podeEditar || pending}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        const n = Number(v);
                        alterar(l.grupo_cliente, {
                          meta: v && n > META_MENSAL_MAX ? String(META_MENSAL_MAX) : v,
                        });
                      }}
                      aria-label={`Reuniões por mês com ${l.grupo_cliente}`}
                      className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm tabular-nums text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
                    />
                    por mês
                  </label>
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => remover(l.grupo_cliente)}
                      disabled={pending}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title={`Tirar ${l.grupo_cliente} da agenda`}
                      aria-label={`Tirar ${l.grupo_cliente} da agenda`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {visiveis.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">
              Nenhum cliente da agenda com “{filtro.trim()}”.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Busca de cliente que devolve sempre o grupo (empresa avulsa sobe para o grupo dela). */
function BuscaGrupo({
  naLista,
  onEscolher,
}: {
  naLista: Set<string>;
  onEscolher: (grupo: string) => void;
}) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [grupos, setGrupos] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const pedido = useRef(0);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) {
      setGrupos([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const id = ++pedido.current;
    const t = window.setTimeout(async () => {
      try {
        const r = await buscarClientes(termo);
        if (id !== pedido.current) return;
        const unicos = [
          ...new Set(r.map((c) => (c.grupo_cliente ?? "").trim()).filter(Boolean)),
        ];
        setGrupos(unicos);
      } finally {
        if (id === pedido.current) setCarregando(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function escolher(grupo: string) {
    onEscolher(grupo);
    setQ("");
    setGrupos([]);
    setAberto(false);
  }

  const mostrar = aberto && q.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative max-w-md">
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAberto(false);
          if (e.key === "Enter") {
            e.preventDefault();
            const primeiro = grupos.find((g) => !naLista.has(g));
            if (primeiro) escolher(primeiro);
          }
        }}
        placeholder="Adicionar cliente: busque pelo grupo, empresa ou CNPJ"
        className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-8 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {carregando && (
        <Loader2
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
        />
      )}
      {mostrar && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {grupos.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">
              {carregando ? "Buscando…" : "Nenhum grupo encontrado."}
            </p>
          ) : (
            grupos.map((g) => {
              const ja = naLista.has(g);
              return (
                <button
                  key={g}
                  type="button"
                  disabled={ja}
                  onClick={() => escolher(g)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-brand-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent"
                >
                  <span className="truncate">{g}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {ja ? "Já na agenda" : "Adicionar"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
