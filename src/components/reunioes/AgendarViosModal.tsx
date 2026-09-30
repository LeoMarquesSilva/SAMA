"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { DateBrInput } from "@/components/ui/DateBrInput";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import {
  parseChecklist,
  rotuloEnviadoAgendamento,
} from "@/lib/proximos-passos-checklist";
import { Badge } from "@/components/ui/Badge";
import { VIOS_PASTA_TIPOS, type ViosPassoEnvio } from "@/lib/vios-agendamento";
import {
  ETIQUETAS_VISUAIS,
  tarefasDaEtiqueta,
} from "@/lib/vios-depara-etiqueta";
import {
  buscarOpcoesVios,
  usuarioViosDoColaborador,
  type OpcaoVios,
} from "@/lib/vios-opcoes";
import { resolverOpcoesVios } from "@/lib/vios-status-actions";
import {
  ResponsaveisSugeridos,
  separarPessoaDoPasso,
} from "@/components/reunioes/PassoResponsavel";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  PencilLine,
  RotateCcw,
  FolderOpen,
  ListChecks,
  Loader2,
  Scale,
  Send,
} from "lucide-react";

type PastaTipo = "Processo" | "Atendimento";

type Linha = ViosPassoEnvio & {
  selecionado: boolean;
  enviadoVios?: boolean;
  enviadoViosEm?: string | null;
  /** Nome que o Fellow indicou, para pré-selecionar o responsável do VIOS. */
  responsavelSugerido?: string;
  /** Filtro visual da lista de tarefas. Não vai para o RPA. */
  grupoEtiqueta: string;
};

type DadosOpcoes = {
  titulo: string | null;
  area: string | null;
  etapas: OpcaoVios[];
  etiquetas: OpcaoVios[];
  usuarios: OpcaoVios[];
};

type EstadoOpcoes =
  | { status: "carregando"; noVios?: boolean }
  | { status: "ok"; dados: DadosOpcoes }
  | { status: "erro"; erro: string };

const ETIQUETA_PADRAO = "PROVIDÊNCIA";

function normalizarNome(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().trim();
}

function idPorNome(opcoes: OpcaoVios[] | undefined, nome: string): string {
  if (!opcoes || !nome.trim()) return "";
  const alvo = normalizarNome(nome);
  return opcoes.find((o) => normalizarNome(o.nome) === alvo)?.id ?? "";
}

function numeroDaLinha(l: Linha): string {
  return ((l.pastaTipo === "Atendimento" ? l.pasta : l.processo) ?? "").trim();
}

/** NNNNNNN-DD.AAAA.J.TR.OOOO (CNJ, 20 dígitos). */
function mascaraCnj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 20);
  const partes: [number, string][] = [
    [7, ""],
    [9, "-"],
    [13, "."],
    [14, "."],
    [16, "."],
    [20, "."],
  ];
  let out = "";
  let ini = 0;
  for (const [fim, sep] of partes) {
    if (d.length <= ini) break;
    out += (ini > 0 ? sep : "") + d.slice(ini, fim);
    ini = fim;
  }
  return out;
}

function mascaraAtendimento(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

/** Número completo o bastante para consultar as opções do VIOS. */
function numeroCompleto(l: Linha): boolean {
  const n = numeroDaLinha(l);
  return l.pastaTipo === "Atendimento"
    ? n.length >= 3
    : n.replace(/\D/g, "").length === 20;
}

function chave(tipo: string | undefined, numero: string): string {
  return `${tipo ?? "Processo"}|${numero}`;
}

export function AgendarViosModal({
  open,
  onClose,
  proximosPassos,
  colaboradores,
  onEnviar,
}: {
  open: boolean;
  onClose: () => void;
  proximosPassos: string;
  colaboradores: ColaboradorOpt[];
  /** Mantido na API; a área não é mais escolhida neste modal. */
  areaPadrao?: string | null;
  onEnviar: (passos: ViosPassoEnvio[]) => Promise<{ ok: boolean; error?: string; id?: string }>;
}) {
  const iniciais = useMemo<Linha[]>(() => {
    return parseChecklist(proximosPassos)
      .filter((i) => i.text.trim())
      .map((i) => {
        const citado = separarPessoaDoPasso(i.text.trim(), colaboradores);
        const sugerido = citado.pessoa?.nome ?? "";
        return {
        selecionado: false,
        text: citado.resto.trim(),
        texto_checklist: i.text.trim(),
        colaborador_id:
          i.colaborador_id || citado.pessoa?.colaborador_id || "",
        prazo: i.prazo ?? "",
        tipo: "",
        tarefa: "",
        tarefa_id: "",
        etiqueta_id: "",
        etiqueta: "",
        grupoEtiqueta: "PROVIDENCIA",
        responsavelSugerido: sugerido,
        responsavel_vios: sugerido,
        pastaTipo: "Processo",
        pasta: "",
        processo: "",
        enviadoVios: Boolean(i.enviadoVios),
        enviadoViosEm: i.enviadoViosEm ?? null,
        };
      });
  }, [proximosPassos, colaboradores]);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [opcoes, setOpcoes] = useState<Record<string, EstadoOpcoes>>({});
  const [erro, setErro] = useState<string>();
  const [pending, start] = useTransition();
  const selecionadas = linhas.filter((l) => l.selecionado);

  useEffect(() => {
    if (open) {
      setLinhas(iniciais);
      setErro(undefined);
    }
  }, [open, iniciais]);

  function patch(index: number, partial: Partial<Linha>) {
    setLinhas((atual) =>
      atual.map((l, i) => (i === index ? { ...l, ...partial } : l))
    );
  }

  /** Preenche o responsável do SAMA quando os usuários da pasta chegam. */
  function aplicarPadroes(dados: DadosOpcoes, k: string) {
    setLinhas((atual) =>
      atual.map((l) => {
        if (chave(l.pastaTipo, numeroDaLinha(l)) !== k) return l;
        const next: Linha = { ...l };
        if (!next.responsavel_vios || !dados.usuarios.some((u) => u.nome === next.responsavel_vios)) {
          const colab = colaboradores.find((c) => c.id === next.colaborador_id);
          const nome = colab?.nome || next.responsavelSugerido;
          next.responsavel_vios =
            usuarioViosDoColaborador(nome, dados.usuarios)?.nome ?? "";
        }
        return next;
      })
    );
  }

  /** Resolve as opções da pasta: catálogo (instantâneo) ou, se preciso, o próprio VIOS. */
  async function carregarOpcoes(tipo: PastaTipo, numero: string) {
    const k = chave(tipo, numero);
    setOpcoes((o) => ({ ...o, [k]: { status: "carregando" } }));
    try {
      let dados: DadosOpcoes;
      const r = await resolverOpcoesVios(tipo, numero);
      if (r.ok) {
        dados = r;
      } else if (r.precisaVios) {
        setOpcoes((o) => ({ ...o, [k]: { status: "carregando", noVios: true } }));
        const v = await buscarOpcoesVios(tipo, numero);
        dados = { titulo: v.titulo, area: (v as { area?: string | null }).area ?? null, etapas: v.etapas, etiquetas: v.etiquetas, usuarios: v.usuarios };
      } else {
        throw new Error(r.erro);
      }
      setOpcoes((o) => ({ ...o, [k]: { status: "ok", dados } }));
      aplicarPadroes(dados, k);
    } catch (e) {
      setOpcoes((o) => ({
        ...o,
        [k]: { status: "erro", erro: e instanceof Error ? e.message : "Falha ao consultar o VIOS." },
      }));
    }
  }

  // Carrega sozinho quando a pasta é informada (sem botão): espera a digitação parar.
  const pendentes = linhas
    .filter((l) => l.selecionado && numeroCompleto(l))
    .map((l) => chave(l.pastaTipo, numeroDaLinha(l)))
    .filter((k, i, a) => a.indexOf(k) === i && !opcoes[k])
    .join(";");
  useEffect(() => {
    if (!pendentes) return;
    const t = setTimeout(() => {
      for (const k of pendentes.split(";")) {
        const [tipo, ...resto] = k.split("|");
        void carregarOpcoes(tipo as PastaTipo, resto.join("|"));
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendentes]);

  function enviar() {
    setErro(undefined);
    if (selecionadas.length === 0) {
      setErro("Marque ao menos um próximo passo para agendar.");
      return;
    }
    for (const [i, l] of selecionadas.entries()) {
      const n = i + 1;
      if (!l.text.trim()) return setErro(`Informe o texto do passo selecionado ${n}.`);
      if (!l.prazo) return setErro(`Informe a data do passo selecionado ${n}.`);
      if (!numeroDaLinha(l)) {
        return setErro(
          l.pastaTipo === "Atendimento"
            ? `Informe a pasta do passo ${n}.`
            : `Informe o processo do passo ${n}.`
        );
      }
      if (!numeroCompleto(l)) {
        return setErro(`Complete o número do processo (CNJ) do passo ${n}.`);
      }
      const op = opcoes[chave(l.pastaTipo, numeroDaLinha(l))];
      if (op?.status !== "ok") {
        return setErro(
          op?.status === "erro"
            ? `Pasta do passo ${n}: ${op.erro}`
            : `Aguarde carregar o responsável da pasta do passo ${n}.`
        );
      }
      if (!l.tarefa?.trim()) return setErro(`Selecione o tipo de tarefa do passo ${n}.`);
      const permitidas = tarefasDaEtiqueta(
        l.grupoEtiqueta,
        l.pastaTipo === "Atendimento" ? "Atendimento" : "Processo",
        op.dados.etapas.map((e) => e.nome)
      );
      if (!permitidas.includes(l.tarefa)) {
        return setErro(
          `O tipo de tarefa "${l.tarefa}" não existe no VIOS para a pasta do passo ${n}. Escolha outro.`
        );
      }
      if (!l.responsavel_vios) return setErro(`Selecione o responsável do passo ${n}.`);
    }
    start(async () => {
      const r = await onEnviar(
        selecionadas.map((l) => {
          const dados = opcoes[chave(l.pastaTipo, numeroDaLinha(l))];
          const catalogo = dados?.status === "ok" ? dados.dados : undefined;
          return {
          text: l.text,
          texto_checklist: l.texto_checklist,
          colaborador_id: l.colaborador_id,
          prazo: l.prazo,
          tipo: ETIQUETA_PADRAO,
          tarefa: l.tarefa,
          tarefa_id: idPorNome(catalogo?.etapas, l.tarefa ?? ""),
          etiqueta_id: idPorNome(catalogo?.etiquetas, ETIQUETA_PADRAO),
          etiqueta: ETIQUETA_PADRAO,
          responsavel_vios: l.responsavel_vios,
          pastaTipo: l.pastaTipo,
          pasta: l.pasta,
          processo: l.processo,
          };
        })
      );
      if (!r.ok) {
        setErro(r.error ?? "Falha ao agendar no VIOS.");
        return;
      }
      onClose();
    });
  }

  const campo =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  const disponiveis = linhas.filter((l) => !l.enviadoVios);
  const todosMarcados =
    disponiveis.length > 0 && disponiveis.every((l) => l.selecionado);

  function marcarTodos(on: boolean) {
    setLinhas((atual) =>
      atual.map((l) => (l.enviadoVios ? l : { ...l, selecionado: on }))
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar para Agendamento"
      size="2xl"
      stacked
      closeDisabled={pending}
    >
      <div className="space-y-5">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { icon: ListChecks, texto: "Marque os passos que vão para o VIOS" },
            { icon: FolderOpen, texto: "Informe o processo ou a pasta de cada um" },
            { icon: Bot, texto: "O robô agenda em até ~2 minutos" },
          ].map(({ icon: Icon, texto }, i) => (
            <li
              key={texto}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-slate-600"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <Icon size={15} className="shrink-0 text-brand-600" />
              <span className="leading-snug">{texto}</span>
            </li>
          ))}
        </ol>

        {linhas.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            Não há próximos passos para agendar. Inclua as ações na reunião e
            salve antes.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Próximos passos ({linhas.length})
              </span>
              {disponiveis.length > 1 && (
                <button
                  type="button"
                  onClick={() => marcarTodos(!todosMarcados)}
                  className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                >
                  {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
                </button>
              )}
            </div>
            <ul className="space-y-3">
              {linhas.map((linha, index) => {
                const rotuloEnvio = rotuloEnviadoAgendamento(linha);
                const numero = numeroDaLinha(linha);
                const op = numero ? opcoes[chave(linha.pastaTipo, numero)] : undefined;
                const dados = op?.status === "ok" ? op.dados : undefined;
                const semOpcoes = !dados;
                const tipoPasta = linha.pastaTipo ?? "Processo";
                const { pessoas, resto } = separarPessoaDoPasso(
                  linha.texto_checklist || linha.text,
                  colaboradores
                );
                const pessoa = pessoas[0] ?? null;
                return (
                  <li
                    key={index}
                    className={clsx(
                      "overflow-hidden rounded-xl border transition-colors",
                      linha.selecionado
                        ? "border-brand-300 bg-white shadow-sm ring-1 ring-brand-100"
                        : "border-slate-200 bg-slate-50/70 hover:border-slate-300"
                    )}
                  >
                    <label
                      className={clsx(
                        "group flex cursor-pointer items-start gap-3.5 px-4 py-3.5 transition-colors",
                        linha.selecionado
                          ? "border-b border-brand-100 bg-brand-50/60"
                          : "hover:bg-white"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={linha.selecionado}
                        onChange={(e) => patch(index, { selecionado: e.target.checked })}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={clsx(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-1",
                          linha.selecionado
                            ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/30"
                            : "border-slate-300 bg-white text-transparent group-hover:border-brand-400"
                        )}
                      >
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1 space-y-2">
                        <span
                          className={clsx(
                            "block text-sm leading-relaxed",
                            linha.selecionado ? "font-medium text-slate-900" : "text-slate-700"
                          )}
                        >
                          {resto}
                        </span>
                        {(pessoas.length > 0 || rotuloEnvio) && (
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {pessoas.length > 0 && (
                              <ResponsaveisSugeridos pessoas={pessoas} />
                            )}
                            {rotuloEnvio && (
                              <Badge tone="green">
                                <CheckCircle2 size={12} className="mr-1" />
                                {rotuloEnvio}
                              </Badge>
                            )}
                          </span>
                        )}
                      </span>
                    </label>

                    {linha.selecionado && (
                      <div className="space-y-4 px-4 py-4">
                        <section className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            1 · Onde agendar
                          </p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
                            <div
                              role="radiogroup"
                              aria-label="Pasta do agendamento"
                              className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                            >
                              {VIOS_PASTA_TIPOS.map((t) => {
                                const Icon = t === "Processo" ? Scale : FolderOpen;
                                const ativo = tipoPasta === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    role="radio"
                                    aria-checked={ativo}
                                    onClick={() =>
                                      !ativo &&
                                      patch(index, {
                                        pastaTipo: t,
                                        pasta: t === "Atendimento" ? linha.pasta : "",
                                        processo: t === "Processo" ? linha.processo : "",
                                        ...(linha.tarefa &&
                                        tarefasDaEtiqueta(linha.grupoEtiqueta, t).includes(linha.tarefa)
                                          ? {}
                                          : { tarefa: "", tarefa_id: "" }),
                                      })
                                    }
                                    className={clsx(
                                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                                      ativo
                                        ? "bg-white text-brand-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    )}
                                  >
                                    <Icon size={14} />
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="space-y-1.5">
                              <div className="relative">
                                <input
                                  aria-label={
                                    tipoPasta === "Processo"
                                      ? "Nº do processo (CNJ)"
                                      : "Nº da pasta de atendimento"
                                  }
                                  value={
                                    (tipoPasta === "Processo" ? linha.processo : linha.pasta) ?? ""
                                  }
                                  onChange={(e) =>
                                    patch(
                                      index,
                                      tipoPasta === "Processo"
                                        ? { processo: mascaraCnj(e.target.value) }
                                        : { pasta: mascaraAtendimento(e.target.value) }
                                    )
                                  }
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder={
                                    tipoPasta === "Processo"
                                      ? "0000000-00.0000.0.00.0000"
                                      : "Nº da pasta — ex.: 51762"
                                  }
                                  className={clsx(
                                    campo,
                                    "pr-9 tabular-nums",
                                    op?.status === "erro" &&
                                      "border-red-300 focus:border-red-500 focus:ring-red-500",
                                    dados && "border-emerald-300"
                                  )}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                                  {op?.status === "carregando" && (
                                    <Loader2 size={16} className="animate-spin text-brand-500" />
                                  )}
                                  {dados && <CheckCircle2 size={16} className="text-emerald-500" />}
                                  {op?.status === "erro" && (
                                    <AlertCircle size={16} className="text-red-500" />
                                  )}
                                </span>
                              </div>
                              {op?.status === "carregando" && (
                                <p className="text-xs text-slate-500">
                                  {op.noVios
                                    ? "Pasta nova para o SAMA: o robô está consultando o VIOS (até ~30 s, só na primeira vez)…"
                                    : "Carregando a pasta e o responsável no VIOS…"}
                                </p>
                              )}
                              {op?.status === "erro" && (
                                <p className="text-xs text-red-600">{op.erro}</p>
                              )}
                              {dados && (
                                <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                  <span className="font-medium text-emerald-700">
                                    {dados.titulo || "Pasta do VIOS"}
                                  </span>
                                </p>
                              )}
                              {!op && (
                                <p className="text-xs text-slate-400">
                                  {tipoPasta === "Processo" && numero
                                    ? `${numero.replace(/\D/g, "").length}/20 dígitos — a pasta e o responsável carregam ao completar o CNJ.`
                                    : "A pasta e o responsável carregam ao digitar o número."}
                                </p>
                              )}
                            </div>
                          </div>
                        </section>

                        <section className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            2 · Tarefa no VIOS
                          </p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <SelectMenu
                              label="Etiqueta"
                              value={linha.grupoEtiqueta}
                              onChange={(v) => {
                                const tarefas = tarefasDaEtiqueta(
                                  v,
                                  tipoPasta,
                                  dados?.etapas.map((e) => e.nome)
                                );
                                patch(index, {
                                  grupoEtiqueta: v,
                                  ...(linha.tarefa && tarefas.includes(linha.tarefa)
                                    ? {}
                                    : { tarefa: "", tarefa_id: "" }),
                                });
                              }}
                              options={ETIQUETAS_VISUAIS.map((e) => ({
                                value: e.value,
                                label: e.label,
                              }))}
                            />
                            <SelectMenu
                              label="Tipo de tarefa"
                              value={linha.tarefa ?? ""}
                              onChange={(v) => patch(index, { tarefa: v, tarefa_id: "" })}
                              emptyOption="Selecione"
                              placeholder="Selecione"
                              searchable
                              options={tarefasDaEtiqueta(
                                linha.grupoEtiqueta,
                                tipoPasta,
                                dados?.etapas.map((e) => e.nome)
                              ).map((nome) => ({
                                value: nome,
                                label: nome,
                              }))}
                            />
                            <SelectMenu
                              label="Responsável"
                              value={linha.responsavel_vios ?? ""}
                              onChange={(v) => patch(index, { responsavel_vios: v })}
                              emptyOption="Selecione"
                              placeholder={semOpcoes ? "Informe a pasta" : "Selecione"}
                              disabled={semOpcoes}
                              searchable
                              options={
                                dados
                                  ? dados.usuarios.map((u) => ({
                                      value: u.nome,
                                      label: u.nome,
                                    }))
                                  : linha.responsavel_vios
                                    ? [
                                        {
                                          value: linha.responsavel_vios,
                                          label: linha.responsavel_vios,
                                        },
                                      ]
                                    : []
                              }
                            />
                            <DateBrInput
                              label="Data para conclusão"
                              value={linha.prazo}
                              onChange={(prazo) => patch(index, { prazo })}
                            />
                          </div>
                        </section>

                        <section className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            3 · Descrição da tarefa
                          </p>
                          <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                <PencilLine size={13} className="text-brand-600" />
                                Texto que aparecerá na tarefa do VIOS
                              </span>
                            </div>
                            <textarea
                              value={linha.text}
                              onChange={(e) => patch(index, { text: e.target.value })}
                              rows={4}
                              placeholder="Descreva o que deve ser feito…"
                              className="block w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                            />
                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
                              <span>
                                {pessoa
                                  ? "A pessoa citada não entra no texto — defina quem executa em Responsável."
                                  : "Seja objetivo: o texto vai como está para o VIOS."}
                              </span>
                              <span className="flex shrink-0 items-center gap-3">
                                {linha.text.trim() !== resto.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => patch(index, { text: resto.trim() })}
                                    className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                                  >
                                    <RotateCcw size={11} />
                                    Restaurar original
                                  </button>
                                )}
                                <span className="tabular-nums">{linha.text.length} caracteres</span>
                              </span>
                            </div>
                          </div>
                        </section>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {erro}
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-4 flex items-center justify-between gap-2 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-5 sm:px-6">
          <p className="text-xs text-slate-500">
            {selecionadas.length === 0
              ? "Nenhum passo selecionado"
              : `${selecionadas.length} passo(s) selecionado(s)`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={enviar}
              disabled={pending || selecionadas.length === 0}
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {pending ? "Enviando…" : `Enviar ${selecionadas.length || ""} ao VIOS`.replace(/\s+/g, " ")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
