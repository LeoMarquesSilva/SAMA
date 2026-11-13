"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { SelectMenu } from "@/components/ui/SelectMenu";
import {
  CLUSTER_CLASSES,
  labelMesCurto,
  labelMesLongo,
  situacaoMeta,
  type LinhaGrupoAgenda,
  type SituacaoGrupo,
} from "@/lib/agenda-positiva";

const POR_VEZ = 50;

const SITUACAO: Record<
  SituacaoGrupo,
  { label: string; icon: LucideIcon; classes: string; ordem: number }
> = {
  zerada: { label: "Sem reunião", icon: XCircle, classes: "bg-red-50 text-red-700", ordem: 0 },
  parcial: { label: "Abaixo da meta", icon: AlertTriangle, classes: "bg-amber-50 text-amber-800", ordem: 1 },
  agendada: { label: "Agendada", icon: CalendarClock, classes: "bg-brand-50 text-brand-700", ordem: 2 },
  realizada: { label: "Com reunião", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-700", ordem: 3 },
  cumprida: { label: "Meta cumprida", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-700", ordem: 3 },
};

function labelSituacao(l: LinhaGrupoAgenda): string {
  if (l.situacao === "agendada") return l.meta ? "Meta agendada" : "Reunião agendada";
  return SITUACAO[l.situacao].label;
}

/** Fundo de cada mês da grade: reuniões × meta (sem meta, basta uma reunião). */
const CELULA = {
  cumprida: "bg-emerald-100 text-emerald-800",
  parcial: "bg-amber-100 text-amber-900",
  zerada: "bg-red-50 text-red-600",
  emCurso: "border border-dashed border-slate-300 bg-white text-slate-600",
} as const;

type Vista = "todos" | "sem" | "com" | "nada";
type Ordem = "prioridade" | "menos" | "mais" | "total" | "antigo" | "nome";

const ORDENS: { value: Ordem; label: string }[] = [
  { value: "prioridade", label: "Prioridade (cluster A, B, C)" },
  { value: "menos", label: "Menos reuniões no mês" },
  { value: "mais", label: "Mais reuniões no mês" },
  { value: "total", label: "Mais reuniões no período" },
  { value: "antigo", label: "Contato mais antigo" },
  { value: "nome", label: "Nome (A–Z)" },
];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const ordemCluster = (l: LinhaGrupoAgenda) => (l.cluster ? "ABC".indexOf(l.cluster) : 3);
const porNome = (a: LinhaGrupoAgenda, b: LinhaGrupoAgenda) =>
  a.grupo.localeCompare(b.grupo, "pt-BR");

const COMPARAR: Record<Ordem, (a: LinhaGrupoAgenda, b: LinhaGrupoAgenda) => number> = {
  prioridade: (a, b) =>
    ordemCluster(a) - ordemCluster(b) ||
    SITUACAO[a.situacao].ordem - SITUACAO[b.situacao].ordem ||
    a.realizadas / (a.meta ?? 1) - b.realizadas / (b.meta ?? 1) ||
    porNome(a, b),
  menos: (a, b) => a.realizadas - b.realizadas || a.total - b.total || porNome(a, b),
  mais: (a, b) =>
    b.realizadas - a.realizadas || b.agendadas - a.agendadas || b.total - a.total || porNome(a, b),
  total: (a, b) => b.total - a.total || b.realizadas - a.realizadas || porNome(a, b),
  antigo: (a, b) => (a.ultima ?? "").localeCompare(b.ultima ?? "") || porNome(a, b),
  nome: porNome,
};

export function AgendaPositivaTabela({
  linhas,
  meses,
  mes,
  mesAtual,
}: {
  linhas: LinhaGrupoAgenda[];
  /** Meses da grade, do mais antigo ao escolhido. */
  meses: string[];
  mes: string;
  mesAtual: string;
}) {
  const [busca, setBusca] = useState("");
  const [vista, setVista] = useState<Vista>("todos");
  const [ordem, setOrdem] = useState<Ordem>("prioridade");
  const [limite, setLimite] = useState(POR_VEZ);

  const buscadas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return termo ? linhas.filter((l) => semAcento(l.grupo).includes(termo)) : linhas;
  }, [linhas, busca]);

  const contagem = useMemo(
    () => ({
      todos: buscadas.length,
      sem: buscadas.filter((l) => l.realizadas === 0).length,
      com: buscadas.filter((l) => l.realizadas > 0).length,
      nada: buscadas.filter((l) => l.total === 0).length,
    }),
    [buscadas]
  );

  const visiveis = useMemo(
    () =>
      buscadas
        .filter((l) => {
          if (vista === "sem") return l.realizadas === 0;
          if (vista === "com") return l.realizadas > 0;
          if (vista === "nada") return l.total === 0;
          return true;
        })
        .sort(COMPARAR[ordem]),
    [buscadas, vista, ordem]
  );

  const n = meses.length;
  const vistas: { chave: Vista; label: string }[] = [
    { chave: "todos", label: "Todos" },
    { chave: "sem", label: `Sem reunião em ${labelMesCurto(mes)}` },
    { chave: "com", label: `Com reunião em ${labelMesCurto(mes)}` },
    { chave: "nada", label: `Nada em ${n} meses` },
  ];

  function baixarCsv() {
    const cab = [
      "Grupo cliente",
      "Cluster",
      "Meta/mês",
      ...meses.map(labelMesCurto),
      `Total ${n} meses`,
      "Agendadas no mês",
      "Último contato",
      `Situação em ${labelMesCurto(mes)}`,
    ];
    const campo = (v: string | number) => {
      const s = String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const corpo = visiveis.map((l) =>
      [
        l.grupo,
        l.cluster ?? "",
        l.meta ?? "",
        ...l.porMes,
        l.total,
        l.agendadas,
        l.ultimaLabel ?? "",
        labelSituacao(l),
      ]
        .map(campo)
        .join(";")
    );
    const blob = new Blob(["﻿" + [cab.map(campo).join(";"), ...corpo].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda-positiva-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Reuniões por grupo cliente · últimos {n} meses
        </h2>
        <Legenda />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(POR_VEZ);
            }}
            placeholder="Buscar grupo"
            aria-label="Buscar grupo cliente"
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1 sm:rounded-full">
          {vistas.map((v) => (
            <button
              key={v.chave}
              type="button"
              onClick={() => {
                setVista(v.chave);
                setLimite(POR_VEZ);
              }}
              className={clsx(
                "rounded-full px-3 py-1 text-sm font-medium transition",
                vista === v.chave ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
              )}
            >
              {v.label}
              <span className="ml-1 tabular-nums text-xs opacity-70">{contagem[v.chave]}</span>
            </button>
          ))}
        </div>
        <SelectMenu
          value={ordem}
          onChange={(v) => setOrdem((v as Ordem) || "prioridade")}
          options={ORDENS}
          className="w-full sm:w-60"
        />
        <button
          type="button"
          onClick={baixarCsv}
          disabled={visiveis.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:ml-auto"
        >
          <Download size={15} />
          Baixar planilha
        </button>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Nenhum grupo com esses filtros.
        </p>
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Grupo cliente</th>
                  <th className="pb-2 pr-3 text-center font-medium">Meta/mês</th>
                  {meses.map((m) => (
                    <th
                      key={m}
                      className={clsx("pb-2 text-center font-medium", m === mes && "text-slate-800")}
                    >
                      {labelMesCurto(m)}
                    </th>
                  ))}
                  <th className="pb-2 pl-2 text-center font-medium">Total</th>
                  <th className="pb-2 pl-3 font-medium">Último contato</th>
                  <th className="pb-2 pl-3 font-medium">{labelMesCurto(mes)}</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.slice(0, limite).map((l) => {
                  const s = SITUACAO[l.situacao];
                  const Icone = s.icon;
                  const meta = l.meta ?? 1;
                  return (
                    <tr key={l.grupo} className="border-t border-slate-100">
                      <td className="max-w-[18rem] py-2 pr-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {l.cluster && (
                            <span
                              className={clsx(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                CLUSTER_CLASSES[l.cluster]
                              )}
                              title={`Cluster ${l.cluster}`}
                            >
                              {l.cluster}
                            </span>
                          )}
                          <span className="truncate font-medium text-slate-800" title={l.grupo}>
                            {l.grupo}
                          </span>
                        </div>
                        {l.semGrupo && (
                          <p className="text-[11px] text-slate-400">Cadastro sem grupo no VIOS</p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center tabular-nums text-slate-600">
                        {l.meta ?? <span className="text-slate-300">—</span>}
                      </td>
                      {meses.map((m, j) => {
                        const qtd = l.porMes[j];
                        const base = situacaoMeta(qtd, meta);
                        const estilo = m === mesAtual && base !== "cumprida" ? "emCurso" : base;
                        return (
                          <td key={m} className="px-0.5 py-1.5">
                            <span
                              className={clsx(
                                "mx-auto flex h-8 w-11 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
                                CELULA[estilo],
                                m === mes && "ring-2 ring-slate-300 ring-offset-1"
                              )}
                              title={`${labelMesLongo(m)}: ${qtd} ${qtd === 1 ? "reunião" : "reuniões"}${l.meta ? ` de ${l.meta}` : ""}${estilo === "emCurso" ? " (mês em curso)" : ""}`}
                            >
                              {qtd}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2 pl-2 text-center font-semibold tabular-nums text-slate-700">
                        {l.total}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-slate-600">
                        {l.ultimaLabel ?? (
                          <span className="text-slate-400">Nada em {n} meses</span>
                        )}
                      </td>
                      <td className="py-2 pl-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                            s.classes
                          )}
                        >
                          <Icone size={13} />
                          {labelSituacao(l)}
                        </span>
                        {l.agendadas > 0 && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            +{l.agendadas} {l.agendadas === 1 ? "agendada" : "agendadas"}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {Math.min(limite, visiveis.length)} de {visiveis.length}{" "}
              {visiveis.length === 1 ? "grupo" : "grupos"}
            </span>
            {visiveis.length > limite && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLimite((x) => x + POR_VEZ)}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Mostrar mais {Math.min(POR_VEZ, visiveis.length - limite)}
                </button>
                <button
                  type="button"
                  onClick={() => setLimite(visiveis.length)}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Mostrar todos
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Legenda() {
  const itens = [
    { label: "Meta cumprida / com reunião", classes: CELULA.cumprida },
    { label: "Abaixo da meta", classes: CELULA.parcial },
    { label: "Sem reunião", classes: CELULA.zerada },
    { label: "Mês em curso", classes: CELULA.emCurso },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {itens.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={clsx("h-3 w-3 rounded-sm", i.classes)} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
