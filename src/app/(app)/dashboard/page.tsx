import Link from "next/link";
import {
  CalendarClock,
  Clock,
  Ban,
  CalendarCheck,
  Video,
  MapPin,
  Building2,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { AvatarGroup } from "@/components/ui/Avatar";
import {
  eachMonthOfInterval,
  startOfMonth,
  startOfYear,
  subMonths,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import {
  atividadeDataConclusaoIso,
  formatDuration,
  formatDateTime,
} from "@/lib/format";
import { linhaCliente } from "@/lib/clientes";
import { DashboardFiltros } from "@/components/dashboard/DashboardFiltros";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { CALENDARIO_PATH } from "@/lib/calendario";
import { TIPO_ATIVIDADE_INTERNA, TIPO_REUNIAO, atividadeTipoOptionsAtividades } from "@/lib/constants";
import { PersonTag } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";

type Periodo = "mes" | "3m" | "6m" | "ano";

function intervalo(p: Periodo): { de: Date; ate: Date } {
  const now = new Date();
  const ate = now;
  if (p === "mes") return { de: startOfMonth(now), ate };
  if (p === "3m") return { de: subMonths(now, 3), ate };
  if (p === "ano") return { de: startOfYear(now), ate };
  return { de: subMonths(now, 6), ate };
}

function Card({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 md:text-sm">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 md:h-9 md:w-9">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-800 md:text-2xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; pessoa?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = (["mes", "3m", "6m", "ano"].includes(sp.p ?? "")
    ? sp.p
    : "6m") as Periodo;
  const { de, ate } = intervalo(periodo);
  const fPessoa = sp.pessoa || "";
  const fTipo = sp.tipo || "";

  const supabase = await createClient();
  const eu = await getPessoaAtual();
  const isAdmin = eu?.is_admin ?? false;
  // Não-admin enxerga apenas os próprios dados.
  const pessoaScope = isAdmin ? fPessoa : eu?.id ?? "__none__";

  let reunioesQ = supabase
    .from("reunioes")
    .select(
      "id, tipo, status, modalidade, data_hora_inicio, participantes:reuniao_participantes(colaborador_id, colaborador:colaboradores(nome, usuario_id))"
    )
    .gte("data_hora_inicio", de.toISOString())
    .lte("data_hora_inicio", ate.toISOString());
  if (fTipo) reunioesQ = reunioesQ.eq("tipo", fTipo);

  let atividadesQ = supabase
    .from("atividades_internas")
    .select(
      "id, tipo, status, titulo, data_hora_inicio, data_hora_fim, duracao_minutos, pessoa_id, pessoa:usuarios!atividades_internas_pessoa_id_fkey(nome, avatar_url)"
    )
    .gte("data_hora_inicio", de.toISOString())
    .lte("data_hora_inicio", ate.toISOString())
    .neq("tipo", "CIENCIA_NF");
  if (pessoaScope) atividadesQ = atividadesQ.eq("pessoa_id", pessoaScope);

  let timesheetQ = supabase
    .from("timesheet_entradas")
    .select("duracao_minutos, pessoa_id, data, pessoa:usuarios(nome)")
    .gte("data", de.toISOString())
    .lte("data", ate.toISOString());
  if (pessoaScope) timesheetQ = timesheetQ.eq("pessoa_id", pessoaScope);

  let pendentesQ = supabase
    .from("outlook_eventos")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDENTE");
  if (!isAdmin && eu?.id) pendentesQ = pendentesQ.eq("pessoa_id", eu.id);

  // Próximas reuniões agendadas (7 dias) — visão de agenda do dia a dia.
  const proximasQ = supabase
    .from("reunioes")
    .select(
      "id, titulo, modalidade, data_hora_inicio, link_online, cliente:pessoas(nome, grupo_cliente), participantes:reuniao_participantes(colaborador_id, colaborador:colaboradores(nome, avatar_url, usuario_id))"
    )
    .eq("status", "AGENDADA")
    .gte("data_hora_inicio", new Date().toISOString())
    .lte(
      "data_hora_inicio",
      new Date(Date.now() + 7 * 86400000).toISOString()
    )
    .order("data_hora_inicio", { ascending: true })
    .limit(6);

  const [
    { data: reunioesRaw },
    { data: atividadesRaw },
    { data: timesheet },
    { data: pessoas },
    { count: pendentes },
    { data: proximasRaw },
  ] = await Promise.all([
    reunioesQ,
    atividadesQ,
    timesheetQ,
    supabase.from("usuarios").select("id, nome, avatar_url").order("nome"),
    pendentesQ,
    proximasQ,
  ]);

  type RRow = {
    tipo: string;
    status: string;
    modalidade: string;
    data_hora_inicio: string;
    participantes: {
      colaborador_id: string;
      colaborador?: { nome?: string; usuario_id?: string | null } | null;
    }[];
  };
  type ProxRow = {
    id: string;
    titulo: string;
    modalidade: string;
    data_hora_inicio: string;
    link_online: string | null;
    cliente?: { nome?: string; grupo_cliente?: string | null } | null;
    participantes: {
      colaborador_id: string;
      colaborador?: {
        nome?: string;
        avatar_url?: string | null;
        usuario_id?: string | null;
      } | null;
    }[];
  };
  let proximas = (proximasRaw as ProxRow[]) ?? [];
  if (!isAdmin && eu?.id) {
    proximas = proximas.filter((r) =>
      (r.participantes ?? []).some((p) => p.colaborador?.usuario_id === eu.id)
    );
  }
  let reunioes = (reunioesRaw as RRow[]) ?? [];
  // Filtro por pessoa (participação via colaborador vinculado).
  if (pessoaScope) {
    reunioes = reunioes.filter((r) =>
      (r.participantes ?? []).some(
        (p) => p.colaborador?.usuario_id === pessoaScope
      )
    );
  }

  type ARow = {
    id: string;
    tipo: string;
    status: string;
    titulo: string;
    data_hora_inicio: string;
    data_hora_fim: string | null;
    duracao_minutos: number | null;
    pessoa_id: string;
    pessoa?: { nome?: string; avatar_url?: string | null } | null;
  };
  const atividades = (atividadesRaw as ARow[]) ?? [];

  // ── Cards ──
  const realizadas = reunioes.filter((r) => r.status === "REALIZADA").length;
  const canceladas = reunioes.filter((r) => r.status === "CANCELADA").length;
  const agendadas = reunioes.filter((r) => r.status === "AGENDADA").length;
  const atvRealizadas = atividades.filter((a) => a.status === "REALIZADA").length;
  const atvCanceladas = atividades.filter((a) => a.status === "CANCELADA").length;
  const horasMin = (timesheet ?? []).reduce(
    (s, t) => s + (t.duracao_minutos ?? 0),
    0
  );

  // ── Tendência por mês × tipo ──
  const meses = eachMonthOfInterval({ start: de, end: ate });
  const trend = meses.map((m) => {
    const key = format(m, "yyyy-MM");
    const label = format(m, "MMM/yy", { locale: ptBR });
    const doMes = reunioes.filter(
      (r) => format(new Date(r.data_hora_inicio), "yyyy-MM") === key
    );
    return {
      mes: label,
      ...Object.fromEntries(
        Object.entries(TIPO_REUNIAO).map(([k, nome]) => [
          nome,
          doMes.filter((r) => r.tipo === k).length,
        ])
      ),
    };
  });

  // ── Modalidade ──
  const modLabels: Record<string, string> = {
    PRESENCIAL_ESCRITORIO: "Escritório",
    PRESENCIAL_EXTERNO: "Externo",
    ONLINE: "Online",
  };
  const modalidade = Object.entries(
    reunioes.reduce<Record<string, number>>((acc, r) => {
      acc[r.modalidade] = (acc[r.modalidade] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: modLabels[k] ?? k, value: v }));

  // ── Horas por pessoa ──
  const horasMap = new Map<string, number>();
  for (const t of timesheet ?? []) {
    const nome = (t.pessoa as { nome?: string } | null)?.nome ?? "—";
    horasMap.set(nome, (horasMap.get(nome) ?? 0) + (t.duracao_minutos ?? 0));
  }
  const horasPorPessoa = [...horasMap.entries()]
    .map(([nome, min]) => ({ nome, horas: +(min / 60).toFixed(1) }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 10);

  // ── Ranking de reuniões por pessoa (participações) ──
  const rankMap = new Map<string, number>();
  for (const r of reunioes) {
    for (const p of r.participantes ?? []) {
      const nome = p.colaborador?.nome ?? "—";
      rankMap.set(nome, (rankMap.get(nome) ?? 0) + 1);
    }
  }
  const ranking = [...rankMap.entries()]
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 10);

  // ── Atividades: tendência por mês × tipo ──
  const trendAtividades = meses.map((m) => {
    const key = format(m, "yyyy-MM");
    const label = format(m, "MMM/yy", { locale: ptBR });
    const doMes = atividades.filter(
      (a) =>
        format(new Date(atividadeDataConclusaoIso(a)), "yyyy-MM") === key
    );
    return {
      mes: label,
      ...Object.fromEntries(
        atividadeTipoOptionsAtividades().map(({ value, label }) => [
          label,
          doMes.filter((a) => a.tipo === value).length,
        ])
      ),
    };
  });

  const porTipoAtividades = Object.entries(
    atividades.reduce<Record<string, number>>((acc, a) => {
      if (a.status === "CANCELADA") return acc;
      acc[a.tipo] = (acc[a.tipo] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({
    name: TIPO_ATIVIDADE_INTERNA[k as keyof typeof TIPO_ATIVIDADE_INTERNA] ?? k,
    value: v,
  }));

  const rankAtvMap = new Map<string, number>();
  for (const a of atividades.filter((x) => x.status === "REALIZADA")) {
    const nome = a.pessoa?.nome ?? "—";
    rankAtvMap.set(nome, (rankAtvMap.get(nome) ?? 0) + 1);
  }
  const rankingAtividades = [...rankAtvMap.entries()]
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 10);

  const recentesAtividades = [...atividades]
    .filter((a) => a.status === "REALIZADA")
    .sort(
      (a, b) =>
        new Date(atividadeDataConclusaoIso(b)).getTime() -
        new Date(atividadeDataConclusaoIso(a)).getTime()
    )
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Análise de reuniões, atividades e timesheet
          </p>
        </div>
      </div>

      {pendentes ? (
        <a
          href={CALENDARIO_PATH}
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          <span>
            <strong>{pendentes}</strong> evento(s) do calendário aguardando
            categorização.
          </span>
          <span className="font-medium underline">Categorizar →</span>
        </a>
      ) : null}

      <DashboardFiltros
        periodo={periodo}
        pessoa={fPessoa}
        tipo={fTipo}
        pessoas={pessoas ?? []}
        isAdmin={isAdmin}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Reuniões realizadas" value={realizadas} icon={CalendarCheck} />
        <Card label="Reuniões agendadas" value={agendadas} icon={CalendarClock} />
        <Card label="Reuniões canceladas" value={canceladas} icon={Ban} />
        <Card
          label="Atividades realizadas"
          value={atvRealizadas}
          icon={ClipboardList}
        />
        <Card label="Atividades canceladas" value={atvCanceladas} icon={Ban} />
        <Card
          label="Horas internas"
          value={formatDuration(horasMin)}
          icon={Clock}
        />
      </div>

      {/* Próximas reuniões (7 dias) */}
      {proximas.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Próximas reuniões · 7 dias
            </h2>
            <Link
              href="/reunioes"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              Ver todas <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {proximas.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {r.modalidade === "ONLINE" ? (
                    <Video size={17} />
                  ) : r.modalidade === "PRESENCIAL_EXTERNO" ? (
                    <MapPin size={17} />
                  ) : (
                    <Building2 size={17} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {r.titulo}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {formatDateTime(r.data_hora_inicio)}
                    {r.cliente?.nome
                      ? ` · ${linhaCliente({ nome: r.cliente.nome, grupo_cliente: r.cliente.grupo_cliente })}`
                      : ""}
                  </p>
                </div>
                {r.participantes && r.participantes.length > 0 && (
                  <AvatarGroup
                    size={22}
                    pessoas={r.participantes.map((p) => ({
                      nome: p.colaborador?.nome ?? "?",
                      avatar_url: p.colaborador?.avatar_url,
                    }))}
                  />
                )}
                {r.link_online && (
                  <a
                    href={r.link_online}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                  >
                    Entrar
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentesAtividades.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Atividades recentes
            </h2>
            <Link
              href="/atividades"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              Ver todas <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {recentesAtividades.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ClipboardList size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {a.titulo}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {TIPO_ATIVIDADE_INTERNA[
                      a.tipo as keyof typeof TIPO_ATIVIDADE_INTERNA
                    ] ?? a.tipo}{" "}
                    · {formatDateTime(atividadeDataConclusaoIso(a))}
                  </p>
                </div>
                {a.pessoa?.nome && (
                  <PersonTag
                    nome={a.pessoa.nome}
                    src={a.pessoa.avatar_url}
                    size={24}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DashboardCharts
        trend={trend}
        modalidade={modalidade}
        horasPorPessoa={horasPorPessoa}
        ranking={ranking}
        trendAtividades={trendAtividades}
        porTipoAtividades={porTipoAtividades}
        rankingAtividades={rankingAtividades}
      />
    </div>
  );
}
