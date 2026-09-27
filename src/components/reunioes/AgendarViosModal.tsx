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
  buscarOpcoesVios,
  usuarioViosDoColaborador,
  type OpcaoVios,
  type OpcoesPastaVios,
} from "@/lib/vios-opcoes";

type PastaTipo = "Processo" | "Atendimento";

type Linha = ViosPassoEnvio & {
  selecionado: boolean;
  enviadoVios?: boolean;
  enviadoViosEm?: string | null;
};

type EstadoOpcoes =
  | { status: "carregando" }
  | { status: "ok"; dados: OpcoesPastaVios }
  | { status: "erro"; erro: string };

const ETIQUETA_PADRAO = "PROVIDÊNCIA";

function numeroDaLinha(l: Linha): string {
  return ((l.pastaTipo === "Atendimento" ? l.pasta : l.processo) ?? "").trim();
}

function chave(tipo: string | undefined, numero: string): string {
  return `${tipo ?? "Processo"}|${numero}`;
}

/** Opções de select com o id quando o VIOS tem nomes repetidos. */
function opcoesSelect(lista: OpcaoVios[]) {
  const conta = new Map<string, number>();
  for (const o of lista) conta.set(o.nome, (conta.get(o.nome) ?? 0) + 1);
  return lista.map((o) => ({
    value: o.id,
    label: (conta.get(o.nome) ?? 0) > 1 ? `${o.nome} (id ${o.id})` : o.nome,
  }));
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
      .map((i) => ({
        selecionado: false,
        text: i.text.trim(),
        colaborador_id: i.colaborador_id ?? "",
        prazo: i.prazo ?? "",
        tipo: "",
        tarefa: "",
        tarefa_id: "",
        etiqueta_id: "",
        etiqueta: "",
        responsavel_vios: "",
        pastaTipo: "Processo",
        pasta: "",
        processo: "",
        enviadoVios: Boolean(i.enviadoVios),
        enviadoViosEm: i.enviadoViosEm ?? null,
      }));
  }, [proximosPassos]);

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

  /** Preenche padrões (etiqueta PROVIDÊNCIA e responsável do SAMA) quando as opções chegam. */
  function aplicarPadroes(dados: OpcoesPastaVios, k: string) {
    setLinhas((atual) =>
      atual.map((l) => {
        if (chave(l.pastaTipo, numeroDaLinha(l)) !== k) return l;
        const next: Linha = { ...l };
        if (!next.etiqueta_id || !dados.etiquetas.some((e) => e.id === next.etiqueta_id)) {
          const et = dados.etiquetas.find((e) => e.nome.toUpperCase() === ETIQUETA_PADRAO);
          next.etiqueta_id = et?.id ?? "";
          next.etiqueta = et?.nome ?? "";
        }
        if (next.tarefa_id && !dados.etapas.some((e) => e.id === next.tarefa_id)) {
          next.tarefa_id = "";
          next.tarefa = "";
        }
        if (!next.responsavel_vios || !dados.usuarios.some((u) => u.nome === next.responsavel_vios)) {
          const colab = colaboradores.find((c) => c.id === next.colaborador_id);
          next.responsavel_vios = usuarioViosDoColaborador(colab?.nome, dados.usuarios)?.nome ?? "";
        }
        return next;
      })
    );
  }

  async function carregarOpcoes(linha: Linha, atualizar = false) {
    const numero = numeroDaLinha(linha);
    if (!numero) return;
    const tipo = (linha.pastaTipo ?? "Processo") as PastaTipo;
    const k = chave(tipo, numero);
    setOpcoes((o) => ({ ...o, [k]: { status: "carregando" } }));
    try {
      const dados = await buscarOpcoesVios(tipo, numero, atualizar);
      setOpcoes((o) => ({ ...o, [k]: { status: "ok", dados } }));
      aplicarPadroes(dados, k);
    } catch (e) {
      setOpcoes((o) => ({
        ...o,
        [k]: { status: "erro", erro: e instanceof Error ? e.message : "Falha ao consultar o VIOS." },
      }));
    }
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
      const op = opcoes[chave(l.pastaTipo, numeroDaLinha(l))];
      if (op?.status !== "ok") {
        return setErro(`Busque as opções do VIOS para a pasta do passo ${n}.`);
      }
      if (!l.tarefa_id) return setErro(`Selecione o tipo de tarefa do passo ${n}.`);
      if (!l.responsavel_vios) return setErro(`Selecione o responsável do passo ${n}.`);
    }
    start(async () => {
      const r = await onEnviar(
        selecionadas.map((l) => ({
          text: l.text,
          colaborador_id: l.colaborador_id,
          prazo: l.prazo,
          tipo: l.etiqueta || "Providências",
          tarefa: l.tarefa,
          tarefa_id: l.tarefa_id,
          etiqueta_id: l.etiqueta_id,
          etiqueta: l.etiqueta,
          responsavel_vios: l.responsavel_vios,
          pastaTipo: l.pastaTipo,
          pasta: l.pasta,
          processo: l.processo,
        }))
      );
      if (!r.ok) {
        setErro(r.error ?? "Falha ao agendar no VIOS.");
        return;
      }
      onClose();
    });
  }

  const campo =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar para Agendamento"
      size="2xl"
      stacked
      closeDisabled={pending}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Marque os passos que vão para o VIOS. Informe a pasta ou o processo e
          clique em <strong>Buscar no VIOS</strong>: as tarefas, etiquetas e
          responsáveis mostrados são exatamente os que o VIOS aceita nessa pasta.
          O robô agenda em até ~2 minutos.
        </p>

        {linhas.length === 0 ? (
          <p className="text-sm text-amber-700">
            Não há próximos passos para agendar. Inclua as ações na reunião e
            salve antes.
          </p>
        ) : (
          <ul className="space-y-3">
            {linhas.map((linha, index) => {
              const rotuloEnvio = rotuloEnviadoAgendamento(linha);
              const numero = numeroDaLinha(linha);
              const op = numero ? opcoes[chave(linha.pastaTipo, numero)] : undefined;
              const dados = op?.status === "ok" ? op.dados : undefined;
              const semOpcoes = !dados;
              return (
                <li
                  key={index}
                  className={clsx(
                    "space-y-3 rounded-xl border p-3",
                    linha.selecionado
                      ? "border-brand-200 bg-brand-50/40"
                      : "border-slate-200 bg-slate-50/70"
                  )}
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={linha.selecionado}
                      onChange={(e) => patch(index, { selecionado: e.target.checked })}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1 space-y-1 text-sm text-slate-800">
                      <span className="block">{linha.text}</span>
                      {rotuloEnvio && <Badge tone="green">{rotuloEnvio}</Badge>}
                    </span>
                  </label>

                  {linha.selecionado && (
                    <>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-slate-700">
                          Descrição da tarefa no VIOS
                        </span>
                        <textarea
                          value={linha.text}
                          onChange={(e) => patch(index, { text: e.target.value })}
                          rows={3}
                          className={campo}
                        />
                      </label>

                      {/* 1) Pasta / processo */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                        <SelectMenu
                          label="Pasta do Agendamento"
                          value={linha.pastaTipo ?? "Processo"}
                          onChange={(v) =>
                            patch(index, {
                              pastaTipo: v,
                              pasta: v === "Atendimento" ? linha.pasta : "",
                              processo: v === "Processo" ? linha.processo : "",
                              tarefa_id: "",
                              tarefa: "",
                            })
                          }
                          options={VIOS_PASTA_TIPOS.map((t) => ({ value: t, label: t }))}
                        />
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-slate-700">
                            {(linha.pastaTipo ?? "Processo") === "Processo"
                              ? "Nº do processo (CNJ)"
                              : "Nº da pasta de atendimento"}
                          </span>
                          <input
                            value={
                              ((linha.pastaTipo ?? "Processo") === "Processo"
                                ? linha.processo
                                : linha.pasta) ?? ""
                            }
                            onChange={(e) =>
                              patch(
                                index,
                                (linha.pastaTipo ?? "Processo") === "Processo"
                                  ? { processo: e.target.value, tarefa_id: "", tarefa: "" }
                                  : { pasta: e.target.value, tarefa_id: "", tarefa: "" }
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void carregarOpcoes(linha);
                              }
                            }}
                            placeholder={
                              (linha.pastaTipo ?? "Processo") === "Processo"
                                ? "0000000-00.0000.0.00.0000"
                                : "Ex.: 51762"
                            }
                            className={campo}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!numero || op?.status === "carregando"}
                          onClick={() => void carregarOpcoes(linha, op?.status === "ok")}
                        >
                          {op?.status === "carregando"
                            ? "Consultando VIOS…"
                            : op?.status === "ok"
                              ? "Atualizar do VIOS"
                              : "Buscar no VIOS"}
                        </Button>
                      </div>

                      {op?.status === "carregando" && (
                        <p className="text-xs text-slate-500">
                          O robô está abrindo a pasta no VIOS (pode levar até 30 s na primeira vez).
                        </p>
                      )}
                      {op?.status === "erro" && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                          {op.erro}
                        </p>
                      )}
                      {dados && (
                        <p className="text-xs text-slate-500">
                          <Badge tone="blue">{dados.titulo || `CI ${dados.ci_pasta}`}</Badge>{" "}
                          {dados.etapas.length} tipos de tarefa disponíveis nesta pasta
                          {dados.fonte === "cache" ? " (lista em cache)" : ""}.
                        </p>
                      )}

                      {/* 2) Opções reais do VIOS */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <SelectMenu
                          label="Tipo de tarefa (VIOS)"
                          value={linha.tarefa_id ?? ""}
                          onChange={(v) =>
                            patch(index, {
                              tarefa_id: v,
                              tarefa: dados?.etapas.find((e) => e.id === v)?.nome ?? "",
                            })
                          }
                          emptyOption="Selecione"
                          placeholder={semOpcoes ? "Busque a pasta no VIOS" : "Selecione"}
                          disabled={semOpcoes}
                          searchable
                          options={dados ? opcoesSelect(dados.etapas) : []}
                        />
                        <SelectMenu
                          label="Etiqueta (VIOS)"
                          value={linha.etiqueta_id ?? ""}
                          onChange={(v) =>
                            patch(index, {
                              etiqueta_id: v,
                              etiqueta: dados?.etiquetas.find((e) => e.id === v)?.nome ?? "",
                            })
                          }
                          emptyOption="Sem etiqueta"
                          placeholder={semOpcoes ? "Busque a pasta no VIOS" : "Selecione"}
                          disabled={semOpcoes}
                          options={dados ? opcoesSelect(dados.etiquetas) : []}
                        />
                        <SelectMenu
                          label="Responsável (VIOS)"
                          value={linha.responsavel_vios ?? ""}
                          onChange={(v) => patch(index, { responsavel_vios: v })}
                          emptyOption="Selecione"
                          placeholder={semOpcoes ? "Busque a pasta no VIOS" : "Selecione"}
                          disabled={semOpcoes}
                          searchable
                          options={(dados?.usuarios ?? []).map((u) => ({
                            value: u.nome,
                            label: u.nome,
                          }))}
                        />
                        <DateBrInput
                          label="Data para conclusão"
                          value={linha.prazo}
                          onChange={(prazo) => patch(index, { prazo })}
                        />
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {erro && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">{selecionadas.length} selecionado(s)</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={enviar}
              disabled={pending || selecionadas.length === 0}
            >
              {pending ? "Enviando…" : `Enviar ${selecionadas.length || ""} ao VIOS`.trim()}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
