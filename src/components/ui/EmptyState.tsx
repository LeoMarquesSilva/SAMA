"use client";

import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Estado vazio com ação. Diferencia "sem dados" (CTA de criação)
 * de "filtros sem resultado" (CTA de limpar filtros).
 */
export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={22} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
