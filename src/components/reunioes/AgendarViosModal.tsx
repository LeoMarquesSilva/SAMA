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
  VIOS_PASTA_TIPOS,
  VIOS_TIPOS_AGENDAMENTO,
  tarefasPorTipoAgendamento,
  type ViosPassoEnvio,
} from "@/lib/vios-agendamento";
type Linha = ViosPassoEnvio & {
  selecionado: boolean;
  enviadoVios?: boolean;
  enviadoViosEm?: string | null;
};

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
    const tipo = "Providências";
    return parseChecklist(proximosPassos)
      .filter((i) => i.text.trim())
      .map((i) => ({
        selecionado: false,
        text: i.text.trim(),
        colaborador_id: i.colaborador_id ?? "",
        prazo: i.prazo ?? "",
        tipo,
        tarefa: "",
        pastaTipo: "Processo",
        pasta: "",
        processo: "",
        enviadoVios: Boolean(i.enviadoVios),
        enviadoViosEm: i.enviadoViosEm ?? null,
      }));
  }, [proximosPassos]);

  const [linhas, setLinhas] = useState<Linha[]>([]);
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

  function enviar() {
    setErro(undefined);
    if (selecionadas.length === 0) {
      setErro("Marque ao menos um próximo passo para agendar.");
      return;
    }
    for (const [i, l] of selecionadas.entries()) {
      if (!l.text.trim()) {
        setErro(`Informe o texto do passo selecionado ${i + 1}.`);
        return;
      }
      if (!l.colaborador_id) {
        setErro(`Selecione o responsável do passo selecionado ${i + 1}.`);
        return;
      }
      if (!l.prazo) {
        setErro(`Informe a data de envio do passo selecionado ${i + 1}.`);
        return;
      }
      if (!l.pastaTipo) {
        setErro(`Selecione Pasta do Agendamento no passo ${i + 1}.`);
        return;
      }
      if (l.pastaTipo === "Processo" && !l.processo?.trim()) {
        setErro(`Informe o processo do passo ${i + 1}.`);
        return;
      }
      if (l.pastaTipo === "Atendimento" && !l.pasta?.trim()) {
        setErro(`Informe a pasta do passo ${i + 1}.`);
        return;
      }
      if (!l.tarefa?.trim()) {
        setErro(`Selecione a tarefa do passo ${i + 1}.`);
        return;
      }
    }
    start(async () => {
      const r = await onEnviar(
        selecionadas.map(
          ({
            text,
            colaborador_id,
            prazo,
            tipo,
            tarefa,
            pastaTipo,
            pasta,
            processo,
          }) => ({
            text,
            colaborador_id,
            prazo,
            tipo,
            tarefa,
            pastaTipo,
            pasta,
            processo,
          })
        )
      );
      if (!r.ok) {
        setErro(r.error ?? "Falha ao agendar no VIOS.");
        return;
      }
      onClose();
    });
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
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Marque só o que vai para a app de agendamento VIOS. O envio leva
          tipo, tarefa, observação, data e pasta.
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
                    onChange={(e) =>
                      patch(index, { selecionado: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="min-w-0 flex-1 space-y-1 text-sm text-slate-800">
                    <span className="block">{linha.text}</span>
                    {rotuloEnvio && (
                      <Badge tone="green">{rotuloEnvio}</Badge>
                    )}
                  </span>
                </label>

                {linha.selecionado && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">
                        Publicação / observação / fluxo de agendamento
                      </span>
                      <textarea
                        value={linha.text}
                        onChange={(e) => patch(index, { text: e.target.value })}
                        rows={3}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectMenu
                        label="Responsável (ENVIAR)"
                        value={linha.colaborador_id}
                        onChange={(v) => patch(index, { colaborador_id: v })}
                        emptyOption="Selecione"
                        options={colaboradores.map((c) => ({
                          value: c.id,
                          label: c.nome,
                        }))}
                      />
                      <DateBrInput
                        label="Data — Enviar"
                        value={linha.prazo}
                        onChange={(prazo) => patch(index, { prazo })}
                      />
                      <SelectMenu
                        label="Tipo"
                        value={linha.tipo}
                        onChange={(v) => {
                          const tarefas = tarefasPorTipoAgendamento(v);
                          patch(index, {
                            tipo: v,
                            tarefa: tarefas.includes(linha.tarefa ?? "")
                              ? linha.tarefa
                              : "",
                          });
                        }}
                        options={VIOS_TIPOS_AGENDAMENTO.map((t) => ({
                          value: t,
                          label: t,
                        }))}
                      />
                      <SelectMenu
                        label="Tarefa"
                        value={linha.tarefa ?? ""}
                        onChange={(v) => patch(index, { tarefa: v })}
                        emptyOption="Selecione"
                        options={tarefasPorTipoAgendamento(linha.tipo).map(
                          (t) => ({
                            value: t,
                            label: t,
                          })
                        )}
                      />
                      <SelectMenu
                        label="Pasta do Agendamento"
                        value={linha.pastaTipo ?? "Processo"}
                        onChange={(v) =>
                          patch(index, {
                            pastaTipo: v,
                            pasta: v === "Atendimento" ? linha.pasta : "",
                            processo: v === "Processo" ? linha.processo : "",
                          })
                        }
                        options={VIOS_PASTA_TIPOS.map((t) => ({
                          value: t,
                          label: t,
                        }))}
                      />
                      {(linha.pastaTipo ?? "Processo") === "Processo" ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-slate-700">
                            Processo
                          </span>
                          <input
                            value={linha.processo ?? ""}
                            onChange={(e) =>
                              patch(index, { processo: e.target.value })
                            }
                            placeholder="Nº do processo"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </label>
                      ) : (
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-slate-700">
                            Pasta
                          </span>
                          <input
                            value={linha.pasta ?? ""}
                            onChange={(e) =>
                              patch(index, { pasta: e.target.value })
                            }
                            placeholder="Nº da pasta"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </label>
                      )}
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
          <p className="text-xs text-slate-400">
            {selecionadas.length} selecionado(s)
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
              {pending
                ? "Enviando…"
                : `Enviar ${selecionadas.length || ""} ao VIOS`.trim()}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
