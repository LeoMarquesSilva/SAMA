"use client";

import { useMemo, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { isTodayInTz, minutesSinceMidnightInTz } from "@/lib/timezone";
import { clsx } from "clsx";
import {
  buildDaySchedule,
  clampDayViewHourPx,
  computeDayViewHours,
  DAY_VIEW_HOUR_PX,
  DAY_VIEW_HOUR_PX_MAX,
  DAY_VIEW_HOUR_PX_MIN,
  DAY_VIEW_HOUR_PX_STEP,
  formatTimedBlockRange,
  layoutTimedBlocks,
  minutesToHeightPx,
  minutesToTopPx,
  type PositionedDayTimedBlock,
} from "@/lib/calendario-day-view";
import {
  formatMultiDayDuration,
  formatTimeRange,
  calendarioItemColor,
} from "@/lib/calendario-events";
import { CalendarioEventBadge } from "@/components/calendario/CalendarioEventBadge";
import { CalendarioSocioAvatar } from "@/components/calendario/CalendarioSocioAvatar";
import type { CalendarioItem } from "@/lib/calendario-items";

const COLUMN_GAP_PX = 3;

export function CalendarioDayTimeView({
  date,
  eventos,
  onSelectEvento,
}: {
  date: Date;
  eventos: CalendarioItem[];
  onSelectEvento: (e: CalendarioItem) => void;
}) {
  const [hourPx, setHourPx] = useState(DAY_VIEW_HOUR_PX);

  const { allDay, timed } = useMemo(
    () => buildDaySchedule(eventos, date),
    [eventos, date]
  );
  const positioned = useMemo(() => layoutTimedBlocks(timed), [timed]);
  const hours = useMemo(() => computeDayViewHours(timed), [timed]);
  const startHour = hours[0] ?? 6;
  const endHour = hours[hours.length - 1] ?? 22;
  const gridHeight = (endHour - startHour) * hourPx;
  const today = isTodayInTz(date);
  const empty = allDay.length === 0 && timed.length === 0;
  const maxColumns = positioned.reduce(
    (max, b) => Math.max(max, b.columnCount),
    1
  );

  function zoomIn() {
    setHourPx((px) => clampDayViewHourPx(px + DAY_VIEW_HOUR_PX_STEP));
  }

  function zoomOut() {
    setHourPx((px) => clampDayViewHourPx(px - DAY_VIEW_HOUR_PX_STEP));
  }

  return (
    <div className="flex flex-col">
      {allDay.length > 0 && (
        <div className="space-y-1 border-b border-slate-100 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Dia inteiro
          </p>
          {allDay.map((e) => (
            <AllDayRow key={e.id} evento={e} onClick={() => onSelectEvento(e)} />
          ))}
        </div>
      )}

      {empty ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">
          Nenhum evento neste dia
        </p>
      ) : (
        timed.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
              <p className="text-[10px] text-slate-400">
                {maxColumns > 1
                  ? `${maxColumns} eventos simultâneos · arraste para ver`
                  : "Grade horária"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={hourPx <= DAY_VIEW_HOUR_PX_MIN}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Diminuir zoom da grade"
                  title="Diminuir zoom"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums text-slate-500">
                  {Math.round((hourPx / DAY_VIEW_HOUR_PX) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={hourPx >= DAY_VIEW_HOUR_PX_MAX}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Aumentar zoom da grade"
                  title="Aumentar zoom"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[min(70vh,640px)] overflow-y-auto">
              <div className="flex">
                <div
                  className="relative w-11 shrink-0 sm:w-14"
                  style={{ height: gridHeight }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute right-1 text-[10px] tabular-nums text-slate-400 sm:text-xs"
                      style={{
                        top: minutesToTopPx(h * 60, startHour, hourPx) - 6,
                      }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                <div
                  className="relative min-w-0 flex-1 border-l border-slate-100 pr-2"
                  style={{ height: gridHeight }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-slate-100"
                      style={{
                        top: minutesToTopPx(h * 60, startHour, hourPx),
                      }}
                    />
                  ))}

                  {today && (
                    <NowIndicator startHour={startHour} hourPx={hourPx} />
                  )}

                  {positioned.map((block) => (
                    <TimedEventBlock
                      key={`${block.event.id}-${block.topMin}-${block.column}`}
                      block={block}
                      startHour={startHour}
                      hourPx={hourPx}
                      onClick={() => onSelectEvento(block.event)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

function AllDayRow({
  evento: e,
  onClick,
}: {
  evento: CalendarioItem;
  onClick: () => void;
}) {
  const c = calendarioItemColor(e);
  const duration = formatMultiDayDuration(
    e.inicio,
    e.fim,
    e.duracao_minutos
  );
  const time = formatTimeRange(e.inicio, e.fim, e.duracao_minutos);
  const socio = e.pessoa?.nome;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full min-w-0 flex-col gap-1 rounded-lg px-2 py-1.5 text-left transition active:opacity-80",
        c.chipBg,
        c.chipText
      )}
      title={socio ? `${socio} · ${e.titulo ?? ""}` : e.titulo ?? undefined}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {duration && (
            <CalendarioEventBadge status={e.status} size="sm">
              {duration}
            </CalendarioEventBadge>
          )}
          {time && !duration && (
            <CalendarioEventBadge status={e.status} size="sm">
              {time}
            </CalendarioEventBadge>
          )}
        </div>
        <CalendarioSocioAvatar evento={e} size={20} />
      </div>
      <span className="truncate text-xs font-medium">{e.titulo}</span>
    </button>
  );
}

function TimedEventBlock({
  block,
  startHour,
  hourPx,
  onClick,
}: {
  block: PositionedDayTimedBlock;
  startHour: number;
  hourPx: number;
  onClick: () => void;
}) {
  const e = block.event;
  const c = calendarioItemColor(e);
  const time = formatTimedBlockRange(block);
  const top = minutesToTopPx(block.topMin, startHour, hourPx);
  const height = minutesToHeightPx(block.heightMin, hourPx);
  const compact = height < 44;
  const widthPct = 100 / block.columnCount;
  const leftPct = block.column * widthPct;
  const socio = e.pessoa?.nome;
  const avatarSize = compact ? 14 : block.columnCount > 2 ? 16 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "absolute z-[1] overflow-hidden rounded-lg border border-black/5 px-1.5 py-1 text-left shadow-sm transition active:opacity-90 sm:px-2",
        c.chipBg,
        c.chipText,
        block.continuesFrom && "rounded-t-none border-t-2 border-t-white/40",
        block.continuesTo && "rounded-b-none border-b-2 border-b-white/40",
        block.columnCount > 1 && "ring-1 ring-black/5"
      )}
      style={{
        top: top + 1,
        height: height - 2,
        left: `calc(${leftPct}% + ${COLUMN_GAP_PX}px)`,
        width: `calc(${widthPct}% - ${COLUMN_GAP_PX * 2}px)`,
        zIndex: block.column + 1,
      }}
      title={
        socio
          ? `${time} · ${socio} · ${e.titulo ?? ""}`
          : `${time} · ${e.titulo ?? ""}`
      }
    >
      {compact ? (
        <span className="flex min-w-0 items-center gap-1 text-[10px] font-medium sm:text-xs">
          <CalendarioSocioAvatar evento={e} size={avatarSize} />
          <span className="min-w-0 truncate">
            <span className="font-bold tabular-nums">{time}</span> {e.titulo}
          </span>
        </span>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <CalendarioEventBadge status={e.status} size="sm">
              {time}
            </CalendarioEventBadge>
            <CalendarioSocioAvatar evento={e} size={avatarSize} />
          </div>
          <p
            className={clsx(
              "mt-1 font-semibold leading-snug",
              block.columnCount > 2
                ? "line-clamp-1 text-[10px] sm:text-xs"
                : "line-clamp-2 text-xs sm:text-sm"
            )}
          >
            {e.titulo}
          </p>
        </>
      )}
    </button>
  );
}

function NowIndicator({
  startHour,
  hourPx,
}: {
  startHour: number;
  hourPx: number;
}) {
  const now = new Date();
  const top = minutesToTopPx(
    minutesSinceMidnightInTz(now),
    startHour,
    hourPx
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-[2] flex items-center"
      style={{ top }}
    >
      <span className="h-2.5 w-2.5 shrink-0 -translate-x-1/2 rounded-full bg-red-500" />
      <span className="h-0.5 flex-1 bg-red-500" />
    </div>
  );
}
