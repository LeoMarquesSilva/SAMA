"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SelectMenu } from "@/components/ui/SelectMenu";
import {
  parseChecklist,
  rotuloEnviadoAgendamento,
  serializeChecklist,
  type ChecklistItem,
} from "@/lib/proximos-passos-checklist";
import type { ColaboradorOpt } from "@/lib/colaboradores";

function initItems(value: string): ChecklistItem[] {
  const parsed = parseChecklist(value);
  return parsed.length > 0
    ? parsed
    : [{ text: "", done: false, colaborador_id: null, prazo: null }];
}

export function ProximosPassosChecklist({
  value,
  onChange,
  error,
  label = "Próximos passos",
  labelAdornment,
  required,
  colaboradores = [],
  simples = true,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  labelAdornment?: React.ReactNode;
  required?: boolean;
  colaboradores?: ColaboradorOpt[];
  simples?: boolean;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(() => initItems(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setItems(initItems(value));
    }
  }, [value]);

  function emitChange(next: ChecklistItem[]) {
    setItems(next);
    const serialized = serializeChecklist(next);
    lastEmitted.current = serialized;
    onChange(serialized);
  }

  function patchItem(index: number, patch: Partial<ChecklistItem>) {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    emitChange(next);
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    emitChange(
      next.length > 0
        ? next
        : [{ text: "", done: false, colaborador_id: null, prazo: null }]
    );
  }

  function addItem() {
    emitChange([
      ...items,
      { text: "", done: false, colaborador_id: null, prazo: null },
    ]);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {labelAdornment}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item, index) => {
          const rotuloEnvio = rotuloEnviadoAgendamento(item);
          return (
          <li
            key={index}
            className={
              simples
                ? "flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                : "grid items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_minmax(10rem,12rem)_8.5rem_auto]"
            }
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => patchItem(index, { done: e.target.checked })}
              className="mt-2.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              aria-label={`Marcar ação ${index + 1}`}
            />
            <div className={simples ? "min-w-0 flex-1 space-y-2" : "min-w-0"}>
              <input
                type="text"
                value={item.text}
                onChange={(e) => patchItem(index, { text: e.target.value })}
                placeholder="Descreva a ação..."
                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {rotuloEnvio && <Badge tone="green">{rotuloEnvio}</Badge>}
            </div>
            {!simples && (
              <>
                <SelectMenu
                  value={item.colaborador_id ?? ""}
                  onChange={(v) =>
                    patchItem(index, { colaborador_id: v || null })
                  }
                  emptyOption="Responsável BP"
                  options={colaboradores.map((c) => ({
                    value: c.id,
                    label: c.nome,
                  }))}
                />
                <input
                  type="date"
                  value={item.prazo ?? ""}
                  onChange={(e) =>
                    patchItem(index, { prazo: e.target.value || null })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  aria-label="Prazo"
                />
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              aria-label="Remover ação"
              className="shrink-0"
            >
              <Trash2 size={15} className="text-slate-400" />
            </Button>
          </li>
          );
        })}
      </ul>

      <Button type="button" variant="secondary" size="sm" onClick={addItem}>
        <Plus size={14} />
        Adicionar ação
      </Button>

      <input
        type="hidden"
        name="proximos_passos"
        value={serializeChecklist(items)}
      />

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
