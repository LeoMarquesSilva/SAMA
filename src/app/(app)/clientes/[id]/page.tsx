import Link from "next/link";
import { FormattedText } from "@/lib/text-format";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, Users } from "lucide-react";
import { requireClientesAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { AvatarGroup } from "@/components/ui/Avatar";
import {
  TIPO_REUNIAO,
  TIPO_REUNIAO_TONE,
  STATUS_REUNIAO,
  MODALIDADE_REUNIAO,
} from "@/lib/constants";
import type {
  Cliente,
  ReuniaoComRelacoes,
  TipoReuniao,
  StatusReuniao,
} from "@/types/database";

export const dynamic = "force-dynamic";

const tipoTone = TIPO_REUNIAO_TONE;
const statusTone: Record<StatusReuniao, "green" | "gray" | "red" | "amber"> = {
  REALIZADA: "green",
  AGENDADA: "gray",
  CANCELADA: "red",
  REAGENDADA: "amber",
};

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireClientesAccess();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("pessoas")
    .select("*")
    .eq("ci", decodeURIComponent(id))
    .maybeSingle();
  if (!cliente) notFound();
  const c = cliente as Cliente;

  const { data: reunioesRaw } = await supabase
    .from("reunioes")
    .select(
      "*, participantes:reuniao_participantes(colaborador_id, colaborador:colaboradores(nome, avatar_url))"
    )
    .eq("cliente_id", decodeURIComponent(id))
    .order("data_hora_inicio", { ascending: false });
  const reunioes = (reunioesRaw as ReuniaoComRelacoes[]) ?? [];

  const realizadas = reunioes.filter((r) => r.status === "REALIZADA").length;
  const agendadas = reunioes.filter((r) => r.status === "AGENDADA");
  const agora = Date.now();
  const proxima = agendadas
    .filter((r) => new Date(r.data_hora_inicio).getTime() >= agora)
    .sort(
      (a, b) =>
        new Date(a.data_hora_inicio).getTime() -
        new Date(b.data_hora_inicio).getTime()
    )[0];
  const ultima = reunioes.find((r) => r.status === "REALIZADA");

  const porTipo = reunioes.reduce<Record<string, number>>((acc, r) => {
    acc[r.tipo] = (acc[r.tipo] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> Voltar para clientes
      </Link>

      {/* Cabeçalho do cliente */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Building2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-800">{c.nome}</h1>
            <p className="text-sm text-slate-500">
              {[
                c.cpf_cnpj ?? "Sem CPF/CNPJ",
                c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {[c.telefone, c.email, c.responsaveis && `Resp.: ${c.responsaveis}`]
                .filter(Boolean)
                .join(" · ") || "Sem contato cadastrado"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={c.tipo === "PESSOA FÍSICA" ? "amber" : "blue"}>
              {c.tipo === "PESSOA FÍSICA" ? "Pessoa Física" : "Pessoa Jurídica"}
            </Badge>
            {c.grupo_cliente && <Badge tone="gray">{c.grupo_cliente}</Badge>}
            <Link
              href="/calendario"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              <CalendarClock size={14} /> Nova reunião
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Reuniões" value={reunioes.length} />
          <Stat label="Realizadas" value={realizadas} />
          <Stat
            label="Última reunião"
            value={ultima ? formatDateTime(ultima.data_hora_inicio) : "—"}
            small
          />
          <Stat
            label="Próxima agendada"
            value={proxima ? formatDateTime(proxima.data_hora_inicio) : "—"}
            small
          />
        </div>

        {Object.keys(porTipo).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(porTipo).map(([t, n]) => (
              <Badge key={t} tone={tipoTone[t as TipoReuniao]}>
                {TIPO_REUNIAO[t as TipoReuniao]}: {n}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Histórico de relacionamento
        </h2>
        {reunioes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Nenhuma reunião registrada com este cliente ainda.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {reunioes.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {r.titulo}
                    </span>
                    <Badge tone={statusTone[r.status]}>
                      {STATUS_REUNIAO[r.status]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone={tipoTone[r.tipo]}>{TIPO_REUNIAO[r.tipo]}</Badge>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={13} />
                      {formatDateTime(r.data_hora_inicio)}
                      {r.duracao_minutos
                        ? ` · ${formatDuration(r.duracao_minutos)}`
                        : ""}
                    </span>
                    <span>{MODALIDADE_REUNIAO[r.modalidade]}</span>
                    {r.participantes && r.participantes.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} />
                        <AvatarGroup
                          size={20}
                          pessoas={r.participantes.map((p) => ({
                            nome: p.colaborador?.nome ?? "?",
                            avatar_url: p.colaborador?.avatar_url,
                          }))}
                        />
                      </span>
                    )}
                  </div>
                  {r.resultado && (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-medium">Resultado:</span>{" "}
                      <FormattedText text={r.resultado} />
                    </p>
                  )}
                  {r.proximos_passos && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">Próximos passos:</span>{" "}
                      {r.proximos_passos}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          small
            ? "text-sm font-semibold text-slate-700"
            : "text-xl font-bold text-slate-800"
        }
      >
        {value}
      </p>
    </div>
  );
}
