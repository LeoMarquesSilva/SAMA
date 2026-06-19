import Link from "next/link";
import {
  Video,
  MapPin,
  Building2,
  ArrowRight,
} from "lucide-react";
import { AvatarGroup } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { formatDateTime } from "@/lib/format";
import { linhaCliente } from "@/lib/clientes";
import { DashboardFiltros } from "@/components/dashboard/DashboardFiltros";
import { DashboardTipoCards } from "@/components/dashboard/DashboardTipoCards";
import { OnboardingHost } from "@/components/onboarding/OnboardingHost";
import {
  TIPO_REUNIAO,
  atividadeTipoOptionsAtividades,
  type TipoReuniaoKey,
} from "@/lib/constants";
import {
  buildDonoCalendarioMap,
  reuniaoVisivelParaUsuario,
} from "@/lib/calendario-items";
import type { OutlookEventoComPessoa, ReuniaoComRelacoes } from "@/types/database";
import {
  dashboardIntervalo,
  parseDashboardDayKey,
  type DashboardPeriodo,
} from "@/lib/dashboard-filtros";
import { countEventosPendentes } from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; data?: string; pessoa?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = (["dia", "mes", "3m", "6m", "ano"].includes(sp.p ?? "")
    ? sp.p
    : "mes") as DashboardPeriodo;
  const dataDia = parseDashboardDayKey(sp.data);
  const { de, ate } = dashboardIntervalo(periodo, dataDia);
  const fPessoa = sp.pessoa || "";
  const fTipo = sp.tipo || "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const onboarding = user
    ? await getOnboardingFlags(supabase, user.id)
    : {
        calendarioConcluido: true,
        dashboardConcluido: true,
        proximosPassosConcluido: true,
      };
  const eu = await getPessoaAtual();
  const isAdmin = eu?.is_admin ?? false;
  const pessoaScope = isAdmin ? fPessoa : eu?.id ?? "__none__";

  let reunioesQ = supabase
    .from("reunioes")
    .select(
      "id, tipo, status, modalidade, data_hora_inicio, criado_por_id, outlook_event_id, participantes:reuniao_participantes(colaborador_id, colaborador:colaboradores(nome, usuario_id))"
    )
    .gte("data_hora_inicio", de.toISOString())
    .lte("data_hora_inicio", ate.toISOString());
  if (fTipo) reunioesQ = reunioesQ.eq("tipo", fTipo);

  let outlookDonoQ = supabase
    .from("outlook_eventos")
    .select(
      "reuniao_id, pessoa_id, outlook_event_id, pessoa:usuarios(id, nome, email, avatar_url)"
    )
    .gte("inicio", de.toISOString())
    .lte("inicio", ate.toISOString());

  let atividadesQ = supabase
    .from("atividades_internas")
    .select("id, tipo, status")
    .gte("data_hora_inicio", de.toISOString())
    .lte("data_hora_inicio", ate.toISOString())
    .neq("tipo", "CIENCIA_NF");
  if (pessoaScope) atividadesQ = atividadesQ.eq("pessoa_id", pessoaScope);

  const pendentesPessoaId = isAdmin ? fPessoa || null : eu?.id ?? null;

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
    { data: outlookDonoRaw },
    { data: atividadesRaw },
    { data: pessoas },
    { data: proximasRaw },
  ] = await Promise.all([
    reunioesQ,
    outlookDonoQ,
    atividadesQ,
    supabase.from("usuarios").select("id, nome, avatar_url").order("nome"),
    proximasQ,
  ]);

  const pendentes = await countEventosPendentes(supabase, {
    pessoaId: pendentesPessoaId ?? undefined,
    isAdmin: isAdmin && !pendentesPessoaId,
  });

  type RRow = {
    id: string;
    tipo: string;
    status: string;
    modalidade: string;
    data_hora_inicio: string;
    criado_por_id: string | null;
    outlook_event_id: string | null;
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
  const donoPorReuniao = buildDonoCalendarioMap(
    // Seleção parcial (reuniao_id, pessoa_id, outlook_event_id, pessoa) — únicos
    // campos usados por buildDonoCalendarioMap. Cast via unknown pois o tipo
    // completo exige colunas que não buscamos aqui.
    (outlookDonoRaw ?? []) as unknown as OutlookEventoComPessoa[],
    reunioes as ReuniaoComRelacoes[]
  );
  if (pessoaScope && pessoaScope !== "__none__") {
    reunioes = reunioes.filter((r) =>
      reuniaoVisivelParaUsuario(r as ReuniaoComRelacoes, pessoaScope, donoPorReuniao)
    );
  }

  type ARow = { tipo: string; status: string };
  const atividades = (atividadesRaw as ARow[]) ?? [];

  const reunioesRealizadas = reunioes.filter((r) => r.status === "REALIZADA");
  const atividadesRealizadas = atividades.filter((a) => a.status === "REALIZADA");

  const reunioesPorTipo = (Object.keys(TIPO_REUNIAO) as TipoReuniaoKey[]).map(
    (key) => ({
      key,
      label: TIPO_REUNIAO[key],
      value: reunioesRealizadas.filter((r) => r.tipo === key).length,
    })
  );

  const atividadesPorTipo = atividadeTipoOptionsAtividades().map(
    ({ value, label }) => ({
      key: value,
      label,
      value: atividadesRealizadas.filter((a) => a.tipo === value).length,
    })
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Análise de reuniões e atividades
          </p>
        </div>
      </div>

      <div data-onboarding="dashboard-filtros">
        <DashboardFiltros
          periodo={periodo}
          dataDia={periodo === "dia" ? dataDia : ""}
          pessoa={fPessoa}
          tipo={fTipo}
          pessoas={pessoas ?? []}
          isAdmin={isAdmin}
        />
      </div>

      <div data-onboarding="dashboard-cards">
        <DashboardTipoCards
          pendentes={pendentes ?? 0}
          reunioesPorTipo={reunioesPorTipo}
          atividadesPorTipo={atividadesPorTipo}
          periodo={periodo}
          dataDia={dataDia}
          pessoa={fPessoa}
        />
      </div>

      {proximas.length > 0 && (
        <div
          data-onboarding="dashboard-proximas"
          className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Próximas reuniões · 7 dias
            </h2>
            <Link
              href="/calendario"
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

      <OnboardingHost
        tourId="dashboard"
        enabled={!onboarding.dashboardConcluido}
      />
    </div>
  );
}
