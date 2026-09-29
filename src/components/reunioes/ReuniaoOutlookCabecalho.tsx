"use client";

import type { RefObject } from "react";
import { CalendarClock, Clock, Timer, Video, MapPin, Building2, Lock } from "lucide-react";
import { clsx } from "clsx";
import { MODALIDADE_REUNIAO } from "@/lib/constants";
import type { ModalidadeReuniao } from "@/types/database";
import { formatDate, formatDateTime, formatDuration, toDatetimeLocal } from "@/lib/format";
import {
  dayKeyInTz,
  formatMonthShortInTz,
  formatTimeInTz,
  formatWeekdayShortInTz,
} from "@/lib/timezone";

function ModalidadeIcon({ modalidade }: { modalidade: ModalidadeReuniao }) {
  const cls = "text-brand-500";
  if (modalidade === "ONLINE") return <Video size={12} className={cls} />;
  if (modalidade === "PRESENCIAL_EXTERNO") return <MapPin size={12} className={cls} />;
  return <Building2 size={12} className={cls} />;
}

export function ReuniaoOutlookCabecalho({
  titulo,
  dataHoraInicio,
  dataHoraFim,
  duracaoMinutos,
  modalidade,
  tituloRef,
  inicioRef,
  fieldErrors,
}: {
  titulo: string;
  dataHoraInicio?: string | null;
  dataHoraFim?: string | null;
  duracaoMinutos?: number | null;
  modalidade: ModalidadeReuniao;
  tituloRef: RefObject<HTMLInputElement | null>;
  inicioRef: RefObject<HTMLInputElement | null>;
  fieldErrors: {
    titulo?: string;
    data_hora_inicio?: string;
    data_hora_fim?: string;
    duracao_minutos?: string;
  };
}) {
  const inicioLocal = toDatetimeLocal(dataHoraInicio);
  const fimLocal = toDatetimeLocal(dataHoraFim);
  const erros = [
    fieldErrors.titulo,
    fieldErrors.data_hora_inicio,
    fieldErrors.data_hora_fim,
    fieldErrors.duracao_minutos,
  ].filter(Boolean);

  const inicio = dataHoraInicio ? new Date(dataHoraInicio) : null;
  const inicioValido = inicio && !Number.isNaN(inicio.getTime()) ? inicio : null;
  const mesmoDia =
    Boolean(dataHoraInicio && dataHoraFim) &&
    dayKeyInTz(dataHoraInicio!) === dayKeyInTz(dataHoraFim!);
  const horario = !dataHoraInicio
    ? "—"
    : mesmoDia || !dataHoraFim
      ? [formatTimeInTz(dataHoraInicio), dataHoraFim && formatTimeInTz(dataHoraFim)]
          .filter(Boolean)
          .join(" – ")
      : `${formatDateTime(dataHoraInicio)} – ${formatDateTime(dataHoraFim)}`;

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border bg-gradient-to-br from-white via-white to-brand-50/60 shadow-sm",
        erros.length ? "border-red-200 ring-1 ring-red-100" : "border-slate-200"
      )}
    >
      <div className="flex items-stretch gap-4 p-4">
        <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded-xl border border-brand-100 bg-white text-center shadow-sm">
          <span className="bg-brand-600 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {inicioValido ? formatMonthShortInTz(inicioValido) : "—"}
          </span>
          <span className="flex flex-1 flex-col items-center justify-center py-1">
            <span className="text-2xl font-bold leading-none tabular-nums text-slate-900">
              {dataHoraInicio ? dayKeyInTz(dataHoraInicio).slice(8, 10) : "—"}
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase text-slate-500">
              {inicioValido ? formatWeekdayShortInTz(inicioValido) : ""}
            </span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
            <CalendarClock size={12} />
            Convite Outlook
          </p>
          <h2 className="mt-0.5 text-lg font-bold leading-snug text-slate-900">
            {titulo || "—"}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium tabular-nums text-slate-700">
              <Clock size={12} className="text-brand-500" />
              {mesmoDia || !dataHoraFim
                ? `${formatDate(dataHoraInicio)} · ${horario}`
                : horario}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
              <Timer size={12} className="text-brand-500" />
              {formatDuration(duracaoMinutos)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
              <ModalidadeIcon modalidade={modalidade} />
              {MODALIDADE_REUNIAO[modalidade]}
            </span>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
        <Lock size={11} className="shrink-0 text-slate-400" />
        Título e horários vêm do Outlook — para alterar, edite o convite no calendário
        e sincronize novamente.
      </p>

      <input
        ref={tituloRef}
        type="hidden"
        name="titulo"
        defaultValue={titulo}
      />
      <input
        ref={inicioRef}
        type="hidden"
        name="data_hora_inicio"
        defaultValue={inicioLocal}
      />
      <input type="hidden" name="data_hora_fim" defaultValue={fimLocal} />
      <input
        type="hidden"
        name="duracao_minutos"
        defaultValue={duracaoMinutos ?? ""}
      />

      {erros.length > 0 && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
          {erros[0]}
        </p>
      )}
    </div>
  );
}
