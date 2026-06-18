"use client";

import type { RefObject } from "react";
import { CalendarClock, Clock, Timer, Video, MapPin, Building2 } from "lucide-react";
import { clsx } from "clsx";
import { MODALIDADE_REUNIAO } from "@/lib/constants";
import type { ModalidadeReuniao } from "@/types/database";
import { formatDateTime, formatDuration, toDatetimeLocal } from "@/lib/format";

function ModalidadeIcon({ modalidade }: { modalidade: ModalidadeReuniao }) {
  if (modalidade === "ONLINE") return <Video size={12} />;
  if (modalidade === "PRESENCIAL_EXTERNO") return <MapPin size={12} />;
  return <Building2 size={12} />;
}

function CampoResumo({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon size={12} className="text-brand-500" />
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums text-slate-800">{value}</span>
    </div>
  );
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

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border shadow-sm ring-1",
        erros.length
          ? "border-red-200 ring-red-100"
          : "border-slate-200/80 ring-slate-100"
      )}
    >
      <div className="bg-gradient-to-br from-white via-slate-50 to-brand-50/50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/20">
            <CalendarClock size={22} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Convite Outlook
            </p>
            <h2 className="mt-0.5 text-lg font-bold leading-snug text-slate-900">
              {titulo || "—"}
            </h2>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              <ModalidadeIcon modalidade={modalidade} />
              {MODALIDADE_REUNIAO[modalidade]}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 bg-white/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <CampoResumo
          label="Início"
          value={formatDateTime(dataHoraInicio)}
          icon={Clock}
        />
        <CampoResumo
          label="Fim"
          value={formatDateTime(dataHoraFim)}
          icon={Clock}
        />
        <CampoResumo
          label="Duração"
          value={formatDuration(duracaoMinutos)}
          icon={Timer}
        />
      </div>

      <p className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs leading-relaxed text-slate-500">
        Título e horários vêm do Outlook. Para alterar, edite o convite no calendário
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
