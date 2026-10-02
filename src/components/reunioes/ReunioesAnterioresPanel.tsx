"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  History,
  ListChecks,
  ListOrdered,
  Target,
  type LucideIcon,
} from "lucide-react";
import { MarkdownView } from "@/components/ui/MarkdownView";
import {
  PessoaChip,
  separarPessoaDoPasso,
} from "@/components/reunioes/PassoResponsavel";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import { listarReunioesAnterioresCliente } from "@/lib/reunioes/actions";
import {
  parsePauta,
  pautaDeReuniaoAnterior,
  pautaTemConteudo,
  type PautaReuniao,
} from "@/lib/pauta";
import { checklistTemItens, parseChecklist } from "@/lib/proximos-passos-checklist";
import { formatDateTime } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

type Anterior = Awaited<ReturnType<typeof listarReunioesAnterioresCliente>>[number];

function BlocoPreview({
  icon: Icon,
  titulo,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h3 className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <Icon size={14} className="text-brand-600" />
        {titulo}
      </h3>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function PautaPreview({ pauta }: { pauta: PautaReuniao }) {
  const assuntos = pauta.assuntos.filter(
    (a) => a.titulo.trim() || a.descricao.trim()
  );
  return (
    <>
      <BlocoPreview icon={Target} titulo="Objetivo">
        <MarkdownView texto={pauta.objetivo} />
      </BlocoPreview>
      {assuntos.length > 0 && (
        <BlocoPreview icon={ListOrdered} titulo="Assuntos tratados">
          <ol className="space-y-3">
            {assuntos.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {a.titulo.trim() || `Assunto ${i + 1}`}
                  </p>
                  {a.descricao.trim() && <MarkdownView texto={a.descricao} />}
                </div>
              </li>
            ))}
          </ol>
        </BlocoPreview>
      )}
      {pauta.pendencias.trim() && (
        <BlocoPreview icon={AlertCircle} titulo="Pendências / pontos para decisão">
          <MarkdownView texto={pauta.pendencias} />
        </BlocoPreview>
      )}
    </>
  );
}

export function ReunioesAnterioresPanel({
  clienteId,
  exceptId,
  onTrazerPauta,
  onRestaurarPauta,
  onTrazerPassos,
  onRemoverPassos,
  incluirPassos = true,
  colaboradores = [],
}: {
  colaboradores?: ColaboradorOpt[];
  clienteId: string | null;
  exceptId?: string | null;
  onTrazerPauta: (pauta: PautaReuniao) => void;
  onRestaurarPauta: () => void;
  /** Reunião nova não leva próximos passos. */
  incluirPassos?: boolean;
  onTrazerPassos: (proximosPassos: string) => void;
  onRemoverPassos: (proximosPassos: string) => void;
}) {
  const [rows, setRows] = useState<Anterior[]>([]);
  const [selPauta, setSelPauta] = useState<Record<string, boolean>>({});
  const [selPassos, setSelPassos] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string>();
  const [preview, setPreview] = useState<Anterior | null>(null);

  useEffect(() => {
    if (!clienteId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    listarReunioesAnterioresCliente(clienteId, exceptId).then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, [clienteId, exceptId]);

  if (!clienteId || rows.length === 0) return null;

  function pautaDaLinha(r: Anterior): PautaReuniao {
    return pautaDeReuniaoAnterior({
      pauta: r.pauta,
      resultado: r.resultado,
      titulo: r.titulo,
      quando: formatDateTime(r.data_hora_inicio),
    });
  }

  function temPauta(r: Anterior) {
    return pautaTemConteudo(pautaDaLinha(r));
  }

  function temPassos(r: Anterior) {
    return checklistTemItens(r.proximos_passos);
  }

  function aplicarPauta(r: Anterior, on: boolean) {
    const next = { ...selPauta, [r.id]: on };
    setSelPauta(next);
    const ativas = rows.filter((row) => next[row.id] && temPauta(row));
    if (ativas.length === 0) {
      onRestaurarPauta();
      setFeedback("Pauta trazida removida.");
      return;
    }
    onTrazerPauta(pautaDaLinha(ativas[0]));
    setFeedback(on ? `Pauta de ${r.titulo} aplicada.` : "Pauta atualizada.");
  }

  function aplicarPassos(r: Anterior, on: boolean) {
    setSelPassos((s) => ({ ...s, [r.id]: on }));
    const texto = r.proximos_passos ?? "";
    if (on) {
      if (!checklistTemItens(texto)) {
        setFeedback("Essa reunião não tem próximos passos para trazer.");
        return;
      }
      onTrazerPassos(texto);
      setFeedback(`Próximos passos de ${r.titulo} aplicados.`);
      return;
    }
    onRemoverPassos(texto);
    setFeedback("Próximos passos trazidos removidos.");
  }

  const pautaPreview = preview ? parsePauta(preview.pauta) : null;
  const passosPreview = preview
    ? parseChecklist(preview.proximos_passos).filter((i) => i.text.trim())
    : [];

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <History size={16} className="text-brand-600" />
        Reuniões anteriores deste cliente
      </h3>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{r.titulo}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(r.data_hora_inicio)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {[
                  temPauta(r) &&
                    (pautaTemConteudo(parsePauta(r.pauta))
                      ? "pauta"
                      : "resumo"),
                  temPassos(r) && "próximos passos",
                ]
                  .filter(Boolean)
                  .join(" · ") || "sem histórico para trazer"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2"
                disabled={!temPauta(r) && !temPassos(r)}
                onClick={() => setPreview(r)}
                aria-label={`Ver pauta e próximos passos de ${r.titulo}`}
              >
                <Eye size={15} />
                Ver
              </Button>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={Boolean(selPauta[r.id])}
                  disabled={!temPauta(r)}
                  onChange={(v) => aplicarPauta(r, v)}
                />
                Trazer pauta
              </label>
              {incluirPassos && (
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={Boolean(selPassos[r.id])}
                  disabled={!temPassos(r)}
                  onChange={(v) => aplicarPassos(r, v)}
                />
                Trazer próximos passos
              </label>
              )}
            </div>
          </li>
        ))}
      </ul>
      {feedback && <p className="text-xs text-brand-700">{feedback}</p>}

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? preview.titulo : "Reunião anterior"}
        size="lg"
        stacked
      >
        {preview && (
          <div className="space-y-4">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium tabular-nums text-slate-600">
              <CalendarDays size={13} className="text-brand-600" />
              {formatDateTime(preview.data_hora_inicio)}
            </p>

            {pautaTemConteudo(pautaPreview) ? (
              <PautaPreview pauta={pautaPreview!} />
            ) : preview.resultado?.trim() ? (
              <BlocoPreview icon={FileText} titulo="Resumo da reunião">
                <MarkdownView texto={preview.resultado} />
              </BlocoPreview>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                Sem pauta nem resumo nesta reunião.
              </p>
            )}

            <BlocoPreview icon={ListChecks} titulo="Próximos passos">
              {passosPreview.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {passosPreview.map((item, i) => {
                    const { pessoas, resto } = separarPessoaDoPasso(
                      item.text,
                      colaboradores
                    );
                    return (
                      <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        {item.done ? (
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle size={16} className="mt-0.5 shrink-0 text-slate-300" />
                        )}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p
                            className={
                              item.done
                                ? "text-sm text-slate-500 line-through decoration-slate-300"
                                : "text-sm text-slate-700"
                            }
                          >
                            {resto}
                          </p>
                          {pessoas.length > 0 && (
                            <span className="flex flex-wrap items-center gap-1.5">
                              {pessoas.map((pessoa) => (
                                <PessoaChip
                                  key={`${pessoa.colaborador_id ?? ""}|${pessoa.email ?? ""}|${pessoa.nome}`}
                                  pessoa={pessoa}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Sem próximos passos nesta reunião.</p>
              )}
            </BlocoPreview>
          </div>
        )}
      </Modal>
    </div>
  );
}
