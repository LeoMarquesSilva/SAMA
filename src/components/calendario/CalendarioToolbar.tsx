"use client";

import { RefreshCw, X } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import {
  CalendarioViewToggle,
  type CalendarioViewMode,
} from "@/components/calendario/CalendarioViewToggle";
import { PessoaChips, type PessoaChipOpt } from "@/components/ui/PessoaChips";
import type { CalendarioTipoFiltro } from "@/lib/calendario-items";

type StatusFiltro = "TODOS" | "PENDENTE";

type FilterOption<T extends string> = {
  key: T;
  label: string;
  count?: number;
  /** Destaque quando há itens pendentes de ação */
  highlightCount?: boolean;
};

function FilterSegment<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:w-14">
        {label}
      </span>
      <div className="min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className="inline-flex gap-1 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label={label}
        >
          {options.map((opt) => {
            const active = value === opt.key;
            const count = opt.count ?? 0;
            const highlight = opt.highlightCount && count > 0;

            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(opt.key)}
                className={clsx(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {opt.label}
                {opt.count !== undefined && (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active
                        ? highlight
                          ? "bg-amber-100 text-amber-700"
                          : "bg-brand-50 text-brand-700"
                        : highlight
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-200/60 text-slate-500"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarioToolbar({
  viewMode,
  onViewModeChange,
  pending,
  isAdmin,
  onAtualizar,
  onSincronizarTodos,
  fStatus,
  onFStatusChange,
  statusCounts,
  fTipo,
  onFTipoChange,
  tipoCounts,
  pessoas,
  fPessoa,
  onFPessoaChange,
  filtrosAtivos,
  onLimparFiltros,
}: {
  viewMode: CalendarioViewMode;
  onViewModeChange: (mode: CalendarioViewMode) => void;
  pending: boolean;
  isAdmin: boolean;
  onAtualizar: () => void;
  onSincronizarTodos: () => void;
  fStatus: StatusFiltro;
  onFStatusChange: (v: StatusFiltro) => void;
  statusCounts: Record<StatusFiltro, number>;
  fTipo: CalendarioTipoFiltro;
  onFTipoChange: (v: CalendarioTipoFiltro) => void;
  tipoCounts: Record<CalendarioTipoFiltro, number>;
  pessoas: PessoaChipOpt[];
  fPessoa: string;
  onFPessoaChange: (id: string) => void;
  filtrosAtivos: boolean;
  onLimparFiltros: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CalendarioViewToggle value={viewMode} onChange={onViewModeChange} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={onAtualizar}
          >
            <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
            Atualizar
          </Button>
          {isAdmin && (
            <Button size="sm" disabled={pending} onClick={onSincronizarTodos}>
              <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
              Sincronizar todos
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <FilterSegment
          label="Status"
          value={fStatus}
          onChange={onFStatusChange}
          options={[
            { key: "TODOS", label: "Todos", count: statusCounts.TODOS },
            {
              key: "PENDENTE",
              label: "Não categorizados",
              count: statusCounts.PENDENTE,
              highlightCount: true,
            },
          ]}
        />

        <FilterSegment
          label="Tipo"
          value={fTipo}
          onChange={onFTipoChange}
          options={[
            { key: "TODOS", label: "Todos os tipos", count: tipoCounts.TODOS },
            { key: "REUNIOES", label: "Reuniões", count: tipoCounts.REUNIOES },
            {
              key: "ATIVIDADES",
              label: "Atividades",
              count: tipoCounts.ATIVIDADES,
            },
          ]}
        />

        {isAdmin && pessoas.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Colaborador
            </p>
            <PessoaChips
              label={null}
              pessoas={pessoas}
              value={fPessoa}
              onChange={onFPessoaChange}
            />
          </div>
        )}

        {filtrosAtivos && (
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onLimparFiltros}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} />
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
