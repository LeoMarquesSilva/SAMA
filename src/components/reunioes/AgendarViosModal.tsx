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
import {
  coparticipantesPadraoInsolvencia,
  demandaIncluiInsolvencia,
  juntarResponsaveis,
  VIOS_PASTA_TIPOS,
  type ViosPassoEnvio,
} from "@/lib/vios-agendamento";
import {
  ETIQUETAS_VISUAIS,
  etiquetasViosDoEnvio,
  tarefasDaEtiqueta,
  TAREFA_REVISAR,
} from "@/lib/vios-depara-etiqueta";
import { usuarioViosDoColaborador, type OpcaoVios } from "@/lib/vios-opcoes";
import {
  listarUsuariosVios,
  type AgendamentoViosStatus,
} from "@/lib/vios-status-actions";
import {
  colaboradorPorNome,
  ResponsaveisSugeridos,
  separarPessoaDoPasso,
} from "@/components/reunioes/PassoResponsavel";
import { StatusVios } from "@/components/reunioes/ProximosPassosChecklist";
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
  X,
} from "lucide-react";

type Linha = ViosPassoEnvio & {
  selecionado: boolean;
  enviadoVios?: boolean;
  enviadoViosEm?: string | null;
  /** Nome que o Fellow indicou, para pré-selecionar o responsável do VIOS. */
  responsavelSugerido?: string;
  /** Providência, Providência de reunião ou Prazo. Define a etiqueta gravada no VIOS. */
  grupoEtiqueta: string;
  /**
   * Pessoas a mais na providência. undefined = ainda não sugerido.
   * Lista vazia = a pessoa tirou todo mundo.
   */
  coparticipantes_vios?: string[];
};

/** Responsáveis e etiquetas do VIOS: iguais para qualquer pasta, carregados uma vez. */
type ListasVios =
  | { status: "carregando" }
  | { status: "ok"; usuarios: OpcaoVios[]; etiquetas: OpcaoVios[] }
  | { status: "erro"; erro: string };

function normalizarNome(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().trim();
}

function idPorNome(opcoes: OpcaoVios[] | undefined, nome: string): string {
  if (!opcoes || !nome.trim()) return "";
  const alvo = normalizarNome(nome);
  return opcoes.find((o) => normalizarNome(o.nome) === alvo)?.id ?? "";
}

/** Ids e nomes que o VIOS deve marcar: a etiqueta da tela e PROVIDÊNCIA DE REUNIÃO. */
function etiquetasDoPasso(opcoes: OpcaoVios[], escolha: string) {
  const lista = etiquetasViosDoEnvio(escolha);
  const ids = lista
    .map((e) => idPorNome(opcoes, e.nome) || e.id)
    .filter(Boolean);
  return {
    principal: lista[0]?.nome ?? "",
    ids: ids.join(","),
    nomes: lista.map((e) => e.nome).join(", "),
  };
}

function normalizarTexto(t: string | null | undefined): string {
  return String(t ?? "").replace(/\s+/g, " ").trim().toLowerCase();
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


export function AgendarViosModal({
  open,
  onClose,
  proximosPassos,
  colaboradores,
  agendamentosVios = [],
  demanda = null,
  onEnviar,
}: {
  open: boolean;
  onClose: () => void;
  proximosPassos: string;
  colaboradores: ColaboradorOpt[];
  /** Situação no VIOS dos passos já enviados (mesmas informações de "Próximos passos"). */
  agendamentosVios?: AgendamentoViosStatus[];
  /** Mantido na API; a área não é mais escolhida neste modal. */
  areaPadrao?: string | null;
  /** Demanda da reunião. Insolvência inclui Lavínia e Lígia nas providências. */
  demanda?: string | null;
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
        revisor_vios: "",
        pastaTipo: "Processo",
        pasta: "",
        processo: "",
        enviadoVios: Boolean(i.enviadoVios),
        enviadoViosEm: i.enviadoViosEm ?? null,
        };
      });
  }, [proximosPassos, colaboradores]);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [listas, setListas] = useState<ListasVios>({ status: "carregando" });
  const [erro, setErro] = useState<string>();
  const [pending, start] = useTransition();
  const selecionadas = linhas.filter((l) => l.selecionado);

  useEffect(() => {
    if (open) {
      setLinhas(iniciais);
      setErro(undefined);
    }
  }, [open, iniciais]);

  // Responsáveis/etiquetas do VIOS: uma consulta só, sem depender da pasta.
  useEffect(() => {
    if (!open || listas.status === "ok") return;
    let vivo = true;
    listarUsuariosVios()
      .then((r) => {
        if (!vivo) return;
        setListas(
          r.ok
            ? { status: "ok", usuarios: r.usuarios, etiquetas: r.etiquetas }
            : { status: "erro", erro: r.erro }
        );
      })
      .catch(() => {
        if (vivo) {
          setListas({
            status: "erro",
            erro: "Não foi possível carregar os responsáveis. Recarregue a página (Ctrl+F5).",
          });
        }
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pré-seleciona o responsável do VIOS a partir do colaborador citado no passo.
  useEffect(() => {
    if (listas.status !== "ok" || !open) return;
    aplicarPadroes(listas.usuarios);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas.status, open, iniciais, demanda]);

  function patch(index: number, partial: Partial<Linha>) {
    setLinhas((atual) =>
      atual.map((l, i) => (i === index ? { ...l, ...partial } : l))
    );
  }

  /** Preenche o responsável do VIOS a partir do colaborador do SAMA. */
  function aplicarPadroes(usuarios: OpcaoVios[]) {
    setLinhas((atual) =>
      atual.map((l) => {
        const coparticipantes =
          l.coparticipantes_vios !== undefined
            ? l.coparticipantes_vios
            : demandaIncluiInsolvencia(demanda)
              ? coparticipantesPadraoInsolvencia(usuarios)
              : undefined;
        if (l.responsavel_vios && usuarios.some((u) => u.nome === l.responsavel_vios)) {
          return coparticipantes === l.coparticipantes_vios
            ? l
            : { ...l, coparticipantes_vios: coparticipantes };
        }
        const colab = colaboradores.find((c) => c.id === l.colaborador_id);
        const nome = colab?.nome || l.responsavelSugerido;
        return {
          ...l,
          responsavel_vios: usuarioViosDoColaborador(nome, usuarios)?.nome ?? "",
          coparticipantes_vios: coparticipantes,
        };
      })
    );
  }

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
      if (!l.tarefa?.trim()) return setErro(`Selecione o tipo de tarefa do passo ${n}.`);
      if (!tarefasDaEtiqueta(l.grupoEtiqueta, l.pastaTipo).includes(l.tarefa)) {
        return setErro(
          `O tipo de tarefa "${l.tarefa}" não existe no VIOS para ${
            l.pastaTipo === "Atendimento" ? "pasta de atendimento" : "processo"
          } (passo ${n}). Escolha outro.`
        );
      }
      if (!l.responsavel_vios) return setErro(`Selecione o responsável do passo ${n}.`);
      if (l.grupoEtiqueta === "PRAZO" && !l.revisor_vios?.trim()) {
        return setErro(
          `Selecione o revisor do passo ${n} — a etiqueta Prazo abre a tarefa ${TAREFA_REVISAR} para ele.`
        );
      }
      if (l.enviadoVios) {
        return setErro(
          `O passo ${n} já foi enviado para agendamento. Desmarque-o para não duplicar a tarefa no VIOS.`
        );
      }
    }
    if (listas.status !== "ok") {
      return setErro("Aguarde carregar a lista de responsáveis do VIOS.");
    }
    const etiquetasVios = listas.etiquetas;
    start(async () => {
      const envio: ViosPassoEnvio[] = [];
      for (const l of selecionadas) {
        const etiqueta = etiquetasDoPasso(etiquetasVios, l.grupoEtiqueta);
        const comum = {
          texto_checklist: l.texto_checklist,
          colaborador_id: l.colaborador_id,
          prazo: l.prazo,
          pastaTipo: l.pastaTipo,
          pasta: l.pasta,
          processo: l.processo,
          // o robô escolhe o tipo de tarefa pelo nome na tela da pasta
          tarefa_id: "",
        };
        envio.push({
          ...comum,
          text: l.text,
          tipo: etiqueta.principal,
          tarefa: l.tarefa,
          // O robô em produção marca um id só. Os dois nomes vão em `etiqueta`
          // (PROVIDÊNCIA ou ENVIAR, mais PROVIDÊNCIA DE REUNIÃO) para a versão
          // nova selecionar as duas no VIOS.
          etiqueta_id: etiqueta.ids.split(",")[0] ?? "",
          etiqueta: etiqueta.nomes,
          responsavel_vios: juntarResponsaveis(
            l.responsavel_vios ?? "",
            l.grupoEtiqueta === "PRAZO" || !demandaIncluiInsolvencia(demanda)
              ? []
              : (l.coparticipantes_vios ?? [])
          ),
          revisor_vios: l.revisor_vios,
        });
        // Prazo (ENVIAR no VIOS) abre também a REVISAR para o revisor escolhido.
        if (l.grupoEtiqueta === "PRAZO" && l.revisor_vios?.trim()) {
          const providencia = etiquetasDoPasso(etiquetasVios, "PROVIDENCIA");
          envio.push({
            ...comum,
            text: `${TAREFA_REVISAR.replace(/^\d+\.\s*/, "")}: ${l.text}`,
            tipo: providencia.principal,
            tarefa: TAREFA_REVISAR,
            etiqueta_id: providencia.ids.split(",")[0] ?? "",
            etiqueta: providencia.nomes,
            responsavel_vios: juntarResponsaveis(
              l.revisor_vios ?? "",
              demandaIncluiInsolvencia(demanda) ? (l.coparticipantes_vios ?? []) : []
            ),
          });
        }
      }
      const r = await onEnviar(envio);
      if (!r.ok) {
        setErro(r.error ?? "Falha ao agendar no VIOS.");
        return;
      }
      onClose();
    });
  }

  const campo =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  /** Responsáveis do VIOS com a foto do colaborador correspondente no SAMA. */
  const opcoesResponsavel = useMemo(
    () =>
      listas.status === "ok"
        ? listas.usuarios.map((u) => {
            const colab = colaboradorPorNome(u.nome, colaboradores);
            return {
              value: u.nome,
              label: u.nome,
              avatar: { nome: colab?.nome ?? u.nome, src: colab?.avatar_url ?? null },
            };
          })
        : [],
    [listas, colaboradores]
  );

  function opcoesResponsavelCom(valor: string | undefined) {
    if (opcoesResponsavel.length > 0) return opcoesResponsavel;
    return valor ? [{ value: valor, label: valor }] : [];
  }

  const placeholderResponsavel =
    listas.status === "carregando"
      ? "Carregando…"
      : listas.status === "erro"
        ? "Erro ao carregar"
        : "Selecione";

  /** Situação no VIOS do último envio deste passo. */
  function agendamentoDaLinha(l: Linha): AgendamentoViosStatus | undefined {
    const chaves = [l.texto_checklist, l.text]
      .map((t) => normalizarTexto(t))
      .filter(Boolean);
    if (chaves.length === 0) return undefined;
    return agendamentosVios.find((a) =>
      chaves.includes(normalizarTexto(a.passo_texto ?? a.observacao))
    );
  }

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
                const tipoPasta = linha.pastaTipo ?? "Processo";
                const { pessoas, resto } = separarPessoaDoPasso(
                  linha.texto_checklist || linha.text,
                  colaboradores
                );
                const pessoa = pessoas[0] ?? null;
                const jaEnviado = Boolean(linha.enviadoVios);
                const agendamento = agendamentoDaLinha(linha);
                return (
                  <li
                    key={index}
                    className={clsx(
                      "overflow-hidden rounded-xl border transition-colors",
                      linha.selecionado
                        ? "border-brand-300 bg-white shadow-sm ring-1 ring-brand-100"
                        : jaEnviado
                          ? "border-slate-200 bg-white"
                          : "border-slate-200 bg-slate-50/70 hover:border-slate-300"
                    )}
                  >
                    <label
                      aria-disabled={jaEnviado}
                      title={
                        jaEnviado
                          ? "Este passo já foi enviado para agendamento — não dá para enviar de novo."
                          : undefined
                      }
                      className={clsx(
                        "group flex items-start gap-3.5 px-4 py-3.5 transition-colors",
                        jaEnviado
                          ? "cursor-default"
                          : linha.selecionado
                            ? "cursor-pointer border-b border-brand-100 bg-brand-50/60"
                            : "cursor-pointer hover:bg-white"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={linha.selecionado}
                        disabled={jaEnviado}
                        onChange={(e) =>
                          !jaEnviado && patch(index, { selecionado: e.target.checked })
                        }
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={clsx(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-1",
                          jaEnviado
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : linha.selecionado
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
                        {/* Mesmas informações de "Próximos passos": tarefa, responsável, data, CI e situação. */}
                        {agendamento && (
                          <StatusVios a={agendamento} colaboradores={colaboradores} />
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
                                  className={clsx(campo, "tabular-nums")}
                                />
                              </div>
                              <p className="text-xs text-slate-400">
                                {tipoPasta === "Processo"
                                  ? numero
                                    ? `${numero.replace(/\D/g, "").length}/20 dígitos do CNJ.`
                                    : "Informe o CNJ do processo."
                                  : "Informe o nº da pasta de atendimento."}
                              </p>
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
                              value={
                                linha.grupoEtiqueta === "PRAZO"
                                  ? "PRAZO"
                                  : "PROVIDENCIA"
                              }
                              onChange={(v) => {
                                const tarefas = tarefasDaEtiqueta(v, tipoPasta);
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
                              options={tarefasDaEtiqueta(linha.grupoEtiqueta, tipoPasta).map((nome) => ({
                                value: nome,
                                label: nome,
                              }))}
                            />
                            <SelectMenu
                              label="Responsável"
                              value={linha.responsavel_vios ?? ""}
                              onChange={(v) => patch(index, { responsavel_vios: v })}
                              emptyOption="Selecione"
                              placeholder={placeholderResponsavel}
                              disabled={listas.status !== "ok"}
                              searchable
                              options={opcoesResponsavelCom(linha.responsavel_vios)}
                            />
                            <DateBrInput
                              label="Data para conclusão"
                              value={linha.prazo}
                              onChange={(prazo) => patch(index, { prazo })}
                            />
                          </div>
                          {/* Prazo vira ENVIAR no VIOS; o revisor recebe a REVISAR do mesmo prazo. */}
                          {linha.grupoEtiqueta === "PRAZO" && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <SelectMenu
                                label="Revisor"
                                value={linha.revisor_vios ?? ""}
                                onChange={(v) => patch(index, { revisor_vios: v })}
                                emptyOption="Selecione"
                                placeholder={placeholderResponsavel}
                                disabled={listas.status !== "ok"}
                                searchable
                                options={opcoesResponsavelCom(linha.revisor_vios)}
                              />
                              <p className="text-xs leading-snug text-slate-500 sm:col-span-1 lg:col-span-3 lg:self-end lg:pb-2">
                                Além do prazo (ENVIAR), o robô abre a tarefa{" "}
                                <span className="font-medium text-slate-600">
                                  {TAREFA_REVISAR}
                                </span>{" "}
                                na mesma pasta e data, com o revisor como responsável.
                              </p>
                            </div>
                          )}
                          {demandaIncluiInsolvencia(demanda) && (
                            <div className="space-y-2">
                              <p className="text-xs leading-snug text-slate-500">
                                {linha.grupoEtiqueta === "PRAZO"
                                  ? "Na tarefa de revisar, além do revisor. Dá para tirar ou incluir outra pessoa."
                                  : "Também nesta providência, junto do responsável. Dá para tirar ou incluir outra pessoa."}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {(linha.coparticipantes_vios ?? []).map((nome) => (
                                  <span
                                    key={nome}
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                                  >
                                    {nome}
                                    <button
                                      type="button"
                                      className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                      aria-label={`Tirar ${nome}`}
                                      onClick={() =>
                                        patch(index, {
                                          coparticipantes_vios: (
                                            linha.coparticipantes_vios ?? []
                                          ).filter((n) => n !== nome),
                                        })
                                      }
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <SelectMenu
                                label="Incluir pessoa"
                                value=""
                                onChange={(v) => {
                                  if (!v) return;
                                  const atual = linha.coparticipantes_vios ?? [];
                                  if (atual.includes(v)) return;
                                  patch(index, { coparticipantes_vios: [...atual, v] });
                                }}
                                emptyOption="Adicionar"
                                placeholder="Adicionar"
                                disabled={listas.status !== "ok"}
                                searchable
                                options={opcoesResponsavelCom(undefined).filter(
                                  (o) =>
                                    o.value &&
                                    o.value !== linha.responsavel_vios &&
                                    o.value !== linha.revisor_vios &&
                                    !(linha.coparticipantes_vios ?? []).includes(o.value)
                                )}
                              />
                            </div>
                          )}
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
