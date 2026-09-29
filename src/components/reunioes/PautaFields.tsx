"use client";

import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { pautaVazia, type PautaReuniao } from "@/lib/pauta";

export function PautaFields({
  value,
  onChange,
}: {
  value: PautaReuniao | null | undefined;
  onChange: (pauta: PautaReuniao) => void;
}) {
  const pauta = value ?? pautaVazia();

  function patch(partial: Partial<PautaReuniao>) {
    onChange({ ...pauta, ...partial });
  }

  function patchAssunto(index: number, partial: PautaReuniao["assuntos"][number]) {
    const assuntos = pauta.assuntos.map((a, i) =>
      i === index ? { ...a, ...partial } : a
    );
    patch({ assuntos });
  }

  return (
    <div
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
      data-onboarding="agenda-pauta"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <ClipboardList size={16} className="text-brand-600" />
        Pauta
      </h3>
      <Textarea
        label="1. Objetivo da reunião"
        value={pauta.objetivo}
        onChange={(e) => patch({ objetivo: e.target.value })}
        rows={4}
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            2. Assuntos a serem tratados
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              patch({
                assuntos: [...pauta.assuntos, { titulo: "", descricao: "" }],
              })
            }
          >
            <Plus size={14} />
            Assunto
          </Button>
        </div>
        {pauta.assuntos.map((a, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
          >
            <Input
              label={`${i + 1}. Assunto`}
              value={a.titulo}
              onChange={(e) =>
                patchAssunto(i, { ...a, titulo: e.target.value })
              }
            />
            <Textarea
              label="Descrição"
              value={a.descricao}
              onChange={(e) =>
                patchAssunto(i, { ...a, descricao: e.target.value })
              }
              rows={2}
            />
            {pauta.assuntos.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="lg:mt-6"
                onClick={() =>
                  patch({
                    assuntos: pauta.assuntos.filter((_, j) => j !== i),
                  })
                }
                aria-label="Remover assunto"
              >
                <Trash2 size={14} />
              </Button>
            ) : (
              <span className="hidden lg:block" />
            )}
          </div>
        ))}
      </div>
      <Textarea
        label="3. Pendências / pontos para decisão"
        value={pauta.pendencias}
        onChange={(e) => patch({ pendencias: e.target.value })}
        rows={4}
      />
    </div>
  );
}
