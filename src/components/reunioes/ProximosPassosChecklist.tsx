"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  parseChecklist,
  serializeChecklist,
  type ChecklistItem,
} from "@/lib/proximos-passos-checklist";

export function ProximosPassosChecklist({
  value,
  onChange,
  error,
  label = "Próximos passos",
  labelAdornment,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  labelAdornment?: React.ReactNode;
  required?: boolean;
}) {
  const items = parseChecklist(value);
  const displayItems = items.length > 0 ? items : [{ text: "", done: false }];

  function update(next: ChecklistItem[]) {
    onChange(serializeChecklist(next));
  }

  function patchItem(index: number, patch: Partial<ChecklistItem>) {
    const next = [...displayItems];
    next[index] = { ...next[index], ...patch };
    update(next);
  }

  function removeItem(index: number) {
    const next = displayItems.filter((_, i) => i !== index);
    update(next.length > 0 ? next : [{ text: "", done: false }]);
  }

  function addItem() {
    update([...displayItems, { text: "", done: false }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        {labelAdornment}
      </div>

      <ul className="space-y-2">
        {displayItems.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => patchItem(index, { done: e.target.checked })}
              className="mt-2.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              aria-label={`Marcar ação ${index + 1}`}
            />
            <input
              type="text"
              value={item.text}
              onChange={(e) => patchItem(index, { text: e.target.value })}
              placeholder="Descreva a ação..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
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
        ))}
      </ul>

      <Button type="button" variant="secondary" size="sm" onClick={addItem}>
        <Plus size={14} />
        Adicionar ação
      </Button>

      <input type="hidden" name="proximos_passos" value={value} />

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
