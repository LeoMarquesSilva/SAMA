"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
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

type Anterior = Awaited<ReturnType<typeof listarReunioesAnterioresCliente>>[number];

function PautaPreview({ pauta }: { pauta: PautaReuniao }) {
  const assuntos = pauta.assuntos.filter(
    (a) => a.titulo.trim() || a.descricao.trim()
  );
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Objetivo
        </p>
        <p className="mt-1 whitespace-pre-wrap">
          {pauta.objetivo.trim() || "—"}
        </p>
      </div>
      {assuntos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Assuntos
          </p>
          <ul className="space-y-2">
            {assuntos.map((a, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-800">
                  {a.titulo.trim() || `Assunto ${i + 1}`}
                </p>
                {a.descricao.trim() && (
                  <p className="mt-1 whitespace-pre-wrap text-slate-600">
                    {a.descricao}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Pendências
        </p>
        <p className="mt-1 whitespace-pre-wrap">
          {pauta.pendencias.trim() || "—"}
        </p>
      </div>
    </div>
  );
}

export function ReunioesAnterioresPanel({
  clienteId,
  exceptId,
  onTrazerPauta,
  onRestaurarPauta,
  onTrazerPassos,
  onRemoverPassos,
}: {
  clienteId: string | null;
  exceptId?: string | null;
  onTrazerPauta: (pauta: PautaReuniao) => void;
  onRestaurarPauta: () => void;
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

  const pautaPreview = preview ? pautaDaLinha(preview) : null;
  const passosPreview = preview
    ? parseChecklist(preview.proximos_passos).filter((i) => i.text.trim())
    : [];

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Reuniões anteriores deste cliente
      </p>
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
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(selPauta[r.id])}
                  disabled={!temPauta(r)}
                  onChange={(e) => aplicarPauta(r, e.target.checked)}
                />
                Trazer pauta
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(selPassos[r.id])}
                  disabled={!temPassos(r)}
                  onChange={(e) => aplicarPassos(r, e.target.checked)}
                />
                Trazer próximos passos
              </label>
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
        {preview && pautaPreview && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              {formatDateTime(preview.data_hora_inicio)}
            </p>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pauta
              </h3>
              {temPauta(preview) ? (
                <PautaPreview pauta={pautaPreview} />
              ) : (
                <p className="text-sm text-slate-500">Sem pauta nesta reunião.</p>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Próximos passos
              </h3>
              {passosPreview.length > 0 ? (
                <ul className="space-y-1.5">
                  {passosPreview.map((item, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Sem próximos passos nesta reunião.
                </p>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
