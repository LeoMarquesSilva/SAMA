"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ClipboardList, Users } from "lucide-react";
import { type TipoReuniaoKey } from "@/lib/constants";
import { dashboardTipoColor } from "@/lib/dashboard-tipo-colors";
import {
  buildCalendarioLinkFromDashboard,
  type DashboardPeriodo,
} from "@/lib/dashboard-filtros";
import { DashboardDistribuicaoPie } from "@/components/dashboard/DashboardDistribuicaoPie";

type TipoItem = {
  id: string;
  label: string;
  value: number;
  color: string;
  href: string;
};

const NAO_CATEGORIZADOS_COLOR = "#f59e0b";

function TipoCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: number;
  color: string;
  href: string;
}) {
  const card = (
    <div
      className="flex min-h-[4.25rem] flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center transition hover:opacity-90"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}45`,
      }}
    >
      <p
        className="text-lg font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
        {label}
      </p>
    </div>
  );

  return (
    <Link href={href} className="block" title={`Ver ${label.toLowerCase()}`}>
      {card}
    </Link>
  );
}

function NaoCategorizadosCard({
  count,
  href,
}: {
  count: number;
  href: string;
}) {
  const color = count > 0 ? NAO_CATEGORIZADOS_COLOR : "#94a3b8";
  const content = (
    <div
      className={clsx(
        "flex min-h-[4.25rem] flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center",
        count > 0 && "transition hover:opacity-90"
      )}
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}45`,
      }}
    >
      <p
        className="text-lg font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {count}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-slate-600">
        Itens não categorizados
      </p>
    </div>
  );

  if (count > 0) {
    return (
      <Link href={href} className="block" title="Categorizar eventos do calendário">
        {content}
      </Link>
    );
  }

  return content;
}

type AgendaFiltro = "reuniao" | "atividade" | "todos";

const DOUBLE_CLICK_MS = 450;

function AgendaKindToggle({
  value,
  onChange,
}: {
  value: AgendaFiltro;
  onChange: (value: AgendaFiltro) => void;
}) {
  const lastClickRef = useRef<{
    option: "reuniao" | "atividade";
    at: number;
    wasActive: boolean;
  } | null>(null);

  function handleClick(option: "reuniao" | "atividade") {
    const now = Date.now();
    const last = lastClickRef.current;

    if (last?.option === option && now - last.at <= DOUBLE_CLICK_MS) {
      if (last.wasActive) onChange("todos");
      lastClickRef.current = null;
      return;
    }

    lastClickRef.current = { option, at: now, wasActive: value === option };

    if (value !== option) {
      onChange(option);
    }
  }

  return (
    <div
      className={clsx(
        "inline-flex shrink-0 rounded-lg border bg-slate-100 p-0.5",
        value === "todos"
          ? "border-brand-300 ring-1 ring-brand-200"
          : "border-slate-200"
      )}
      role="tablist"
      aria-label="Filtrar por reunião ou atividade. Clique duas vezes na opção ativa para ver tudo."
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "reuniao"}
        onClick={() => handleClick("reuniao")}
        className={clsx(
          "inline-flex select-none items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition sm:px-2.5 sm:text-xs",
          value === "reuniao"
            ? "bg-white text-brand-700 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        <Users size={13} />
        Reunião
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "atividade"}
        onClick={() => handleClick("atividade")}
        className={clsx(
          "inline-flex select-none items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition sm:px-2.5 sm:text-xs",
          value === "atividade"
            ? "bg-white text-brand-700 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        <ClipboardList size={13} />
        Atividade
      </button>
    </div>
  );
}

export function DashboardTipoCards({
  pendentes,
  reunioesPorTipo,
  atividadesPorTipo,
  periodo,
  dataDia,
  pessoa,
}: {
  pendentes: number;
  reunioesPorTipo: { key: TipoReuniaoKey; label: string; value: number }[];
  atividadesPorTipo: { key: string; label: string; value: number }[];
  periodo: DashboardPeriodo;
  dataDia: string;
  pessoa: string;
}) {
  const [filtro, setFiltro] = useState<AgendaFiltro>("todos");
  const linkOpts = { periodo, dataDia, pessoa: pessoa || undefined };

  const items: TipoItem[] = [
    ...reunioesPorTipo.map(({ key, label, value }) => {
      const id = `reuniao:${key}`;
      return {
        id,
        label,
        value,
        color: dashboardTipoColor(id),
        href: buildCalendarioLinkFromDashboard(
          { card: "reuniao", tipo: key },
          linkOpts
        ),
      };
    }),
    ...atividadesPorTipo.map(({ key, label, value }) => {
      const id = `atividade:${key}`;
      return {
        id,
        label,
        value,
        color: dashboardTipoColor(id),
        href: buildCalendarioLinkFromDashboard(
          { card: "atividade", tipo: key },
          linkOpts
        ),
      };
    }),
  ];

  const itemsVisiveis =
    filtro === "todos"
      ? items
      : items.filter((item) =>
          filtro === "reuniao"
            ? item.id.startsWith("reuniao:")
            : item.id.startsWith("atividade:")
        );

  const pieItems = [...itemsVisiveis]
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
    .map(({ label, value, color }) => ({
      label,
      value,
      color,
    }));

  const pendenteHref = buildCalendarioLinkFromDashboard(
    { card: "pendente" },
    linkOpts
  );

  const gridCards = [
    {
      kind: "pendente" as const,
      value: pendentes,
      href: pendenteHref,
    },
    ...itemsVisiveis.map((item) => ({
      kind: "tipo" as const,
      ...item,
    })),
  ].sort(
    (a, b) =>
      b.value - a.value ||
      (a.kind === "pendente"
        ? "Itens não categorizados"
        : a.label
      ).localeCompare(
        b.kind === "pendente" ? "Itens não categorizados" : b.label,
        "pt-BR"
      )
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
      <section className="flex min-h-[22rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 md:p-5 lg:min-h-[28rem]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-700">
              Agenda consolidada
            </h2>
            <p className="text-xs text-slate-500">
              Realizadas no período selecionado
            </p>
          </div>
          <AgendaKindToggle value={filtro} onChange={setFiltro} />
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {gridCards.map((card) =>
            card.kind === "pendente" ? (
              <NaoCategorizadosCard
                key="pendente"
                count={card.value}
                href={card.href}
              />
            ) : (
              <TipoCard
                key={card.id}
                label={card.label}
                value={card.value}
                color={card.color}
                href={card.href}
              />
            )
          )}
        </div>
      </section>

      <DashboardDistribuicaoPie items={pieItems} />
    </div>
  );
}
