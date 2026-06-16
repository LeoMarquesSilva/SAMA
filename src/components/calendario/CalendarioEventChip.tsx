"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { CalendarioEventBadge } from "@/components/calendario/CalendarioEventBadge";
import { CalendarioSocioAvatar } from "@/components/calendario/CalendarioSocioAvatar";
import { calendarioItemColor, formatTimeRange } from "@/lib/calendario-events";
import type { CalendarioItem } from "@/lib/calendario-items";

const MAX_VISIBLE = 3;

/** Bloco colorido de evento — sempre renderizado dentro da célula do calendário. */
export function CalendarioEventChip({
  evento,
  onClick,
  showTime = true,
  hideTimeBadgeOnMobile = false,
  size = "sm",
}: {
  evento: CalendarioItem;
  onClick: () => void;
  showTime?: boolean;
  /** Oculta badge de horário em telas pequenas (ex.: mês no celular). */
  hideTimeBadgeOnMobile?: boolean;
  size?: "sm" | "md";
}) {
  const c = calendarioItemColor(evento);
  const time = showTime
    ? formatTimeRange(evento.inicio, evento.fim, evento.duracao_minutos)
    : null;
  const socio = evento.pessoa?.nome;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        "flex w-full min-w-0 flex-col rounded-md text-left leading-tight transition active:opacity-80",
        c.chipBg,
        c.chipText,
        size === "sm" ? "gap-0.5 px-1 py-1" : "gap-0.5 px-1.5 py-1.5"
      )}
      title={
        time && socio
          ? `${time} · ${socio} · ${evento.titulo ?? ""}`
          : time
            ? `${time} · ${evento.titulo ?? ""}`
            : socio
              ? `${socio} · ${evento.titulo ?? ""}`
              : (evento.titulo ?? undefined)
      }
    >
      {hideTimeBadgeOnMobile ? (
        <>
          <span
            className={clsx(
              "truncate font-normal leading-snug opacity-95 sm:hidden",
              size === "sm" ? "text-[10px]" : "text-xs"
            )}
          >
            {evento.titulo}
          </span>
          <div className="hidden flex-col gap-0.5 sm:flex">
            <div className="flex items-start justify-between gap-0.5">
              {time ? (
                <CalendarioEventBadge
                  status={evento.status}
                  itemKind={evento.itemKind}
                  size={size}
                >
                  {time}
                </CalendarioEventBadge>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <CalendarioSocioAvatar
                evento={evento}
                size={size === "sm" ? 14 : 16}
              />
            </div>
            <span
              className={clsx(
                "line-clamp-2 font-normal leading-snug opacity-95",
                size === "sm" ? "text-[10px]" : "text-xs"
              )}
            >
              {evento.titulo}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-0.5">
            {time ? (
              <CalendarioEventBadge
                status={evento.status}
                itemKind={evento.itemKind}
                size={size}
              >
                {time}
              </CalendarioEventBadge>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            <CalendarioSocioAvatar
              evento={evento}
              size={size === "sm" ? 14 : 16}
            />
          </div>
          <span
            className={clsx(
              "line-clamp-2 font-normal leading-snug opacity-95",
              size === "sm" ? "text-[10px]" : "text-xs"
            )}
          >
            {evento.titulo}
          </span>
        </>
      )}
    </button>
  );
}

export function CalendarioDayEvents({
  eventos,
  onSelectEvento,
  showTime = true,
  hideTimeBadgeOnMobile = false,
  size = "sm",
}: {
  eventos: CalendarioItem[];
  onSelectEvento: (e: CalendarioItem) => void;
  showTime?: boolean;
  hideTimeBadgeOnMobile?: boolean;
  size?: "sm" | "md";
}) {
  const [expanded, setExpanded] = useState(false);

  if (eventos.length === 0) return null;

  const hidden = eventos.length - MAX_VISIBLE;
  const shown = expanded ? eventos : eventos.slice(0, MAX_VISIBLE);

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {shown.map((e) => (
        <CalendarioEventChip
          key={e.id}
          evento={e}
          onClick={() => onSelectEvento(e)}
          showTime={showTime}
          hideTimeBadgeOnMobile={hideTimeBadgeOnMobile}
          size={size}
        />
      ))}
      {hidden > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="truncate px-0.5 text-left text-[10px] font-medium text-brand-600 hover:text-brand-800 active:text-brand-900"
        >
          Mais {hidden}
        </button>
      )}
      {expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="truncate px-0.5 text-left text-[10px] font-medium text-slate-500 hover:text-slate-700"
        >
          Menos
        </button>
      )}
    </div>
  );
}
