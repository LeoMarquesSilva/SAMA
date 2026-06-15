"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { dayKey, groupSingleDayEventsByDay } from "@/lib/calendario-events";
import { statusCalendarColor } from "@/lib/calendario-events";
import {
  computeMultiDayPlacements,
  countMultiDayLanes,
  DAY_NUMBER_H,
  MULTI_DAY_LANE_H,
  splitIntoWeeks,
} from "@/lib/calendario-layout";
import {
  addDaysInTz,
  addMonthsInTz,
  dateFromDayKey,
  dayKeyInTz,
  daysInMonthGrid,
  formatDayInTz,
  formatMonthShortInTz,
  formatMonthYearInTz,
  formatWeekdayLongInTz,
  formatWeekdayShortInTz,
  formatWeekRangeEndInTz,
  isSameDayInTz,
  isTodayInTz,
  todayDateInTz,
  todayDayNumberInTz,
  weekDayKeysContaining,
} from "@/lib/timezone";
import { CalendarioDayEvents } from "@/components/calendario/CalendarioEventChip";
import { CalendarioMultiDayBar } from "@/components/calendario/CalendarioMultiDayBar";
import { CalendarioDayTimeView } from "@/components/calendario/CalendarioDayTimeView";
import type { OutlookEventoComPessoa } from "@/types/database";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

type GridMode = "mes" | "semana" | "dia";

export function CalendarioMobileView({
  eventos,
  onSelectEvento,
}: {
  eventos: OutlookEventoComPessoa[];
  onSelectEvento: (e: OutlookEventoComPessoa) => void;
}) {
  const [gridMode, setGridMode] = useState<GridMode>("mes");
  const [cursorDate, setCursorDate] = useState(() => todayDateInTz());

  const singleByDay = useMemo(
    () => groupSingleDayEventsByDay(eventos),
    [eventos]
  );

  const cursorMonthKey = dayKeyInTz(cursorDate).slice(0, 7);
  const weekDayKeys = useMemo(
    () => weekDayKeysContaining(cursorDate),
    [cursorDate]
  );
  const weekDays = useMemo(
    () => weekDayKeys.map(dateFromDayKey),
    [weekDayKeys]
  );

  const monthGridDays = useMemo(
    () => daysInMonthGrid(cursorDate),
    [cursorDate]
  );

  const monthWeeks = useMemo(
    () => splitIntoWeeks(monthGridDays),
    [monthGridDays]
  );

  const monthStrip = useMemo(() => {
    const [y, m] = cursorMonthKey.split("-").map(Number);
    const months: Date[] = [];
    for (let i = -2; i <= 4; i++) {
      months.push(addMonthsInTz(dateFromDayKey(`${y}-${String(m).padStart(2, "0")}-01`), i));
    }
    return months;
  }, [cursorMonthKey]);

  const dayStrip = useMemo(
    () => weekDayKeys.map(dateFromDayKey),
    [weekDayKeys]
  );

  const headerLabel =
    gridMode === "mes"
      ? formatMonthYearInTz(cursorDate)
      : gridMode === "semana"
        ? `${formatDayInTz(weekDays[0])} – ${formatWeekRangeEndInTz(weekDays[6])}`
        : formatWeekdayLongInTz(cursorDate);

  function goToday() {
    setCursorDate(todayDateInTz());
  }

  function goToDay(date: Date) {
    setCursorDate(date);
    setGridMode("dia");
  }

  function selectMonth(month: Date) {
    const mk = dayKeyInTz(month).slice(0, 7);
    setCursorDate(dateFromDayKey(`${mk}-01`));
  }

  function prev() {
    setCursorDate((d) => {
      if (gridMode === "mes") return addMonthsInTz(d, -1);
      if (gridMode === "semana") return addDaysInTz(d, -7);
      return addDaysInTz(d, -1);
    });
  }

  function next() {
    setCursorDate((d) => {
      if (gridMode === "mes") return addMonthsInTz(d, 1);
      if (gridMode === "semana") return addDaysInTz(d, 7);
      return addDaysInTz(d, 1);
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-center gap-1 border-b border-slate-100 px-2 py-2">
        {(
          [
            { key: "mes" as const, label: "Mês" },
            { key: "semana" as const, label: "Semana" },
            { key: "dia" as const, label: "Dia" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setGridMode(key)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-4",
              gridMode === key
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {gridMode === "dia" ? (
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2.5 scrollbar-none">
          {dayStrip.map((d) => {
            const active = isSameDayInTz(d, cursorDate);
            const today = isTodayInTz(d);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setCursorDate(d)}
                className={clsx(
                  "flex min-w-[44px] shrink-0 flex-col items-center rounded-xl px-2 py-1.5 transition",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <span className="text-[10px] font-medium uppercase">
                  {formatWeekdayShortInTz(d)}
                </span>
                <span
                  className={clsx(
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    today && !active && "bg-brand-100 text-brand-700",
                    today && active && "ring-2 ring-white/80"
                  )}
                >
                  {formatDayInTz(d)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2.5 scrollbar-none">
        {monthStrip.map((m) => {
          const active = dayKeyInTz(m).slice(0, 7) === cursorMonthKey;
          return (
            <button
              key={m.toISOString()}
              type="button"
              onClick={() => selectMonth(m)}
              className={clsx(
                "shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              {formatMonthShortInTz(m)}.
            </button>
          );
        })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <button
          type="button"
          onClick={prev}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
          aria-label={
            gridMode === "mes"
              ? "Mês anterior"
              : gridMode === "semana"
                ? "Semana anterior"
                : "Dia anterior"
          }
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="truncate text-sm font-semibold capitalize text-slate-800 sm:text-base"
          >
            {headerLabel}
          </button>
          {!isTodayInTz(cursorDate) && (
            <button
              type="button"
              onClick={goToday}
              className="flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-2 text-[11px] font-bold text-brand-700"
              title="Ir para hoje"
            >
              {todayDayNumberInTz()}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={next}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
          aria-label={
            gridMode === "mes"
              ? "Próximo mês"
              : gridMode === "semana"
                ? "Próxima semana"
                : "Próximo dia"
          }
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {gridMode !== "dia" && (
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="py-1.5 text-center text-[11px] font-semibold text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>
      )}

      {gridMode === "mes" ? (
        monthWeeks.map((days, wi) => (
          <WeekRow
            key={wi}
            days={days}
            eventos={eventos}
            singleByDay={singleByDay}
            inMonth={(day) =>
              dayKeyInTz(day).slice(0, 7) === cursorMonthKey
            }
            onSelectEvento={onSelectEvento}
            onSelectDay={goToDay}
            height="month"
          />
        ))
      ) : gridMode === "semana" ? (
        <WeekRow
          days={weekDays}
          eventos={eventos}
          singleByDay={singleByDay}
          inMonth={() => true}
          onSelectEvento={onSelectEvento}
          onSelectDay={goToDay}
          height="week"
        />
      ) : (
        <CalendarioDayTimeView
          date={cursorDate}
          eventos={eventos}
          onSelectEvento={onSelectEvento}
        />
      )}

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-2">
        {(
          [
            ["PENDENTE", "Pendente"],
            ["CATEGORIZADO_REUNIAO", "Reunião"],
            ["CATEGORIZADO_ATIVIDADE", "Atividade"],
            ["IGNORADO", "Ignorado"],
          ] as const
        ).map(([status, label]) => (
          <span
            key={status}
            className="inline-flex items-center gap-1 text-[10px] text-slate-500"
          >
            <span
              className={clsx(
                "h-2 w-2 rounded-sm",
                statusCalendarColor[status].chipBg
              )}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  days,
  eventos,
  singleByDay,
  inMonth,
  onSelectEvento,
  onSelectDay,
  height,
}: {
  days: Date[];
  eventos: OutlookEventoComPessoa[];
  singleByDay: Map<string, OutlookEventoComPessoa[]>;
  inMonth: (day: Date) => boolean;
  onSelectEvento: (e: OutlookEventoComPessoa) => void;
  onSelectDay: (day: Date) => void;
  height: "month" | "week";
}) {
  const placements = useMemo(
    () => computeMultiDayPlacements(days, eventos),
    [days, eventos]
  );
  const laneCount = countMultiDayLanes(placements);
  const lanesHeight = laneCount * MULTI_DAY_LANE_H;
  const minDayHeight = height === "month" ? 72 : 140;

  return (
    <div className="relative grid grid-cols-7 border-b border-slate-100">
      {days.map((day) => (
        <DayCell
          key={dayKey(day)}
          day={day}
          events={singleByDay.get(dayKey(day)) ?? []}
          inMonth={inMonth(day)}
          onSelectEvento={onSelectEvento}
          onSelectDay={onSelectDay}
          height={height}
          lanesHeight={lanesHeight}
          minHeight={minDayHeight}
        />
      ))}

      {laneCount > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 grid grid-cols-7"
          style={{
            top: DAY_NUMBER_H,
            height: lanesHeight,
            gridTemplateRows: `repeat(${laneCount}, ${MULTI_DAY_LANE_H}px)`,
          }}
        >
          {placements.map((p) => (
            <CalendarioMultiDayBar
              key={`${p.event.id}-${p.startCol}-${p.lane}`}
              placement={p}
              onClick={onSelectEvento}
              hideBadgesOnMobile={height === "month"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCell({
  day,
  events,
  inMonth,
  onSelectEvento,
  onSelectDay,
  height,
  lanesHeight,
  minHeight,
}: {
  day: Date;
  events: OutlookEventoComPessoa[];
  inMonth: boolean;
  onSelectEvento: (e: OutlookEventoComPessoa) => void;
  onSelectDay: (day: Date) => void;
  height: "month" | "week";
  lanesHeight: number;
  minHeight: number;
}) {
  const today = isTodayInTz(day);
  const dayNum = formatDayInTz(day);

  return (
    <div
      className={clsx(
        "flex min-w-0 flex-col border-r border-slate-100 p-0.5",
        !inMonth && "bg-slate-50/60"
      )}
      style={{ minHeight: minHeight + lanesHeight }}
    >
      <div
        className="flex shrink-0 justify-center"
        style={{ height: DAY_NUMBER_H }}
      >
        <button
          type="button"
          onClick={() => onSelectDay(day)}
          className={clsx(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition hover:bg-slate-100 active:bg-slate-200 sm:h-7 sm:w-7 sm:text-sm",
            today && "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
            !today && inMonth && "text-slate-800",
            !today && !inMonth && "text-slate-400"
          )}
          aria-label={`Ver dia ${dayNum}`}
        >
          {dayNum}
        </button>
      </div>

      {/* Espaço reservado para barras multi-dia (renderizadas no overlay da semana) */}
      {lanesHeight > 0 && (
        <div className="shrink-0" style={{ height: lanesHeight }} aria-hidden />
      )}

      <CalendarioDayEvents
        eventos={events}
        onSelectEvento={onSelectEvento}
        showTime
        hideTimeBadgeOnMobile={height === "month"}
        size={height === "week" ? "md" : "sm"}
      />
    </div>
  );
}
