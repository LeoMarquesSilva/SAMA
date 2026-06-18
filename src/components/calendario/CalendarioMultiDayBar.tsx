"use client";

import { clsx } from "clsx";
import {
  formatMultiDayDuration,
  formatTimeRange,
} from "@/lib/calendario-events";
import { CalendarioEventBadge } from "@/components/calendario/CalendarioEventBadge";
import { CalendarioSocioAvatar } from "@/components/calendario/CalendarioSocioAvatar";
import {
  calendarioSocioLabel,
  corCalendarioItemParaUsuario,
  statusCalendarioParaUsuario,
  type CalendarioItem,
} from "@/lib/calendario-items";
import type { MultiDayPlacement } from "@/lib/calendario-layout";

/** Barra contínua que atravessa várias colunas do calendário. */
export function CalendarioMultiDayBar({
  placement,
  onClick,
  hideBadgesOnMobile = false,
  pessoaAtualId = null,
}: {
  placement: MultiDayPlacement;
  onClick: (e: CalendarioItem) => void;
  /** Oculta badges de duração/horário em telas pequenas (ex.: mês no celular). */
  hideBadgesOnMobile?: boolean;
  pessoaAtualId?: string | null;
}) {
  const { event, startCol, span, lane, continuesFrom, continuesTo } =
    placement;
  const status = statusCalendarioParaUsuario(event, pessoaAtualId);
  const c = corCalendarioItemParaUsuario(event, pessoaAtualId);
  const duration = formatMultiDayDuration(
    event.inicio,
    event.fim,
    event.duracao_minutos
  );
  const time = formatTimeRange(
    event.inicio,
    event.fim,
    event.duracao_minutos
  );
  const tooltip = [duration, time, calendarioSocioLabel(event), event.titulo]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={clsx(
        "pointer-events-auto mx-px flex min-h-full min-w-0 flex-col justify-center gap-0.5 px-1 py-0.5 text-left leading-tight transition active:opacity-80",
        c.chipBg,
        c.chipText,
        continuesFrom ? "rounded-l-none" : "rounded-l-md",
        continuesTo ? "rounded-r-none" : "rounded-r-md"
      )}
      style={{
        gridColumn: `${startCol} / span ${span}`,
        gridRow: lane + 1,
      }}
      title={tooltip || event.titulo || undefined}
    >
      {hideBadgesOnMobile ? (
        <>
          <span className="truncate text-[10px] font-medium sm:hidden">
            {event.titulo}
          </span>
          <div className="hidden flex-col justify-center gap-0.5 sm:flex">
            <div className="flex items-start justify-between gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-0.5">
                {duration && (
                  <CalendarioEventBadge status={status} itemKind={event.itemKind} size="sm">
                    {duration}
                  </CalendarioEventBadge>
                )}
                {time && (
                  <CalendarioEventBadge status={status} itemKind={event.itemKind} size="sm">
                    {time}
                  </CalendarioEventBadge>
                )}
              </div>
              <CalendarioSocioAvatar evento={event} size={14} />
            </div>
            <span className="w-full truncate text-[11px] font-medium">
              {event.titulo}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-0.5">
              {duration && (
                <CalendarioEventBadge status={event.status} itemKind={event.itemKind} size="sm">
                  {duration}
                </CalendarioEventBadge>
              )}
              {time && (
                <CalendarioEventBadge status={event.status} itemKind={event.itemKind} size="sm">
                  {time}
                </CalendarioEventBadge>
              )}
            </div>
            <CalendarioSocioAvatar evento={event} size={14} />
          </div>
          <span className="w-full truncate text-[10px] font-medium sm:text-[11px]">
            {event.titulo}
          </span>
        </>
      )}
    </button>
  );
}
