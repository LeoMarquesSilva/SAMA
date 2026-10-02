import { Suspense } from "react";
import { requireModulo } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import {
  avatarDaPessoa,
  ensureColaboradoresSync,
  mapaAvatarColaboradorPorEmail,
} from "@/lib/colaboradores";
import { OutlookClient } from "@/components/outlook/OutlookClient";
import { CalendarioAutoSync } from "@/components/calendario/CalendarioAutoSync";
import { ListPageSkeleton } from "@/components/ui/Skeleton";
import {
  calendarioEventQueryRange,
  REUNIAO_CALENDARIO_LIST_SELECT,
  OUTLOOK_CALENDARIO_LIST_SELECT,
  resolveCalendarioPessoaScope,
} from "@/lib/calendario";
import { parseCalendarioFiltroInicial } from "@/lib/dashboard-filtros";
import {
  buildDonoCalendarioMap,
  agruparReunioesDuplicadasAdmin,
  mergeCalendarioItems,
  reuniaoVisivelParaUsuario,
  type CalendarioItem,
} from "@/lib/calendario-items";
import { canViewAgendaTodos, podeVerAgendaDe } from "@/lib/constants";
import { outlookConfigurado } from "@/lib/graph";
import { fellowConfigurado } from "@/lib/fellow";
import { listarTiposReuniao } from "@/lib/reuniao-tipos.server";
import type {
  AtividadeComPessoa,
  OutlookEventoComPessoa,
  ReuniaoComRelacoes,
} from "@/types/database";

export const dynamic = "force-dynamic";
/** Sync Graph (várias mailboxes) pode passar de 60s na Vercel. */
export const maxDuration = 300;

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const pessoa = await requireModulo("calendario");
  after(() => ensureColaboradoresSync());
  const sp = await searchParams;
  const filtroInicial = parseCalendarioFiltroInicial(sp);

  const supabase = await createClient();
  const onboarding = {
    calendarioConcluido: pessoa?.onboarding_calendario_concluido ?? true,
    dashboardConcluido: pessoa?.onboarding_dashboard_concluido ?? true,
    proximosPassosConcluido:
      pessoa?.onboarding_proximos_passos_concluido ?? true,
  };
  const verAgendaTodos = canViewAgendaTodos(pessoa);
  const tiposReuniao = await listarTiposReuniao();
  const { start, end } = calendarioEventQueryRange();

  // Desativado sai das seleções; quem só não tem login continua na lista.
  const { data: pessoasRaw, error: pessoasErr } = await supabase
    .from("usuarios")
    .select("id, nome, email, avatar_url, departamento, cargo, is_admin")
    .is("desativado_em", null)
    .order("nome");
  // Sem log, um erro aqui some e a lista de agendas fica vazia sem explicação.
  if (pessoasErr) {
    console.error("[calendario] falha ao listar usuarios:", pessoasErr.message);
  }
  const pessoasBase = (pessoasRaw ?? []).filter((p) => podeVerAgendaDe(pessoa, p));
  const pessoaScope = resolveCalendarioPessoaScope(
    filtroInicial.pessoa,
    pessoa?.id ?? null,
    verAgendaTodos,
    pessoasBase.map((p) => p.id)
  );

  let outlookQuery = supabase
    .from("outlook_eventos")
    .select(OUTLOOK_CALENDARIO_LIST_SELECT)
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio", { ascending: true, nullsFirst: false });

  if (pessoaScope.mode === "user") {
    outlookQuery = outlookQuery.eq("pessoa_id", pessoaScope.pessoaId);
  }

  let reunioesQuery = supabase
    .from("reunioes")
    .select(REUNIAO_CALENDARIO_LIST_SELECT)
    .gte("data_hora_inicio", start)
    .lte("data_hora_inicio", end)
    .order("data_hora_inicio", { ascending: true });

  let atividadesQuery = supabase
    .from("atividades_internas")
    .select(
      "*, pessoa:usuarios!atividades_internas_pessoa_id_fkey(id, nome, avatar_url), com_pessoa:usuarios!atividades_internas_com_pessoa_id_fkey(id, nome, avatar_url)"
    )
    .gte("data_hora_inicio", start)
    .lte("data_hora_inicio", end)
    .neq("tipo", "CIENCIA_NF")
    .order("data_hora_inicio", { ascending: true });

  if (pessoaScope.mode === "user") {
    atividadesQuery = atividadesQuery.eq("pessoa_id", pessoaScope.pessoaId);
  }

  const [
    { data: eventos },
    { data: reunioesRaw },
    { data: atividadesRaw },
    { data: colaboradores },
    avatares,
  ] = await Promise.all([
    outlookQuery,
    reunioesQuery,
    atividadesQuery,
    supabase
      .from("colaboradores")
      .select("id, nome, email, departamento, avatar_url, usuario_id")
      .eq("ativo", true)
      .order("nome"),
    mapaAvatarColaboradorPorEmail(supabase),
  ]);
  const pessoas = pessoasBase.map((p) => ({
    ...p,
    avatar_url: avatarDaPessoa(p.email, p.avatar_url, avatares),
  }));

  const eventosOutlook = (eventos as unknown as OutlookEventoComPessoa[]) ?? [];
  const reunioesAll = (reunioesRaw as unknown as ReuniaoComRelacoes[]) ?? [];
  const donoPorReuniao = buildDonoCalendarioMap(eventosOutlook, reunioesAll);

  let reunioes = reunioesAll;
  if (pessoaScope.mode === "user") {
    reunioes = reunioes.filter((r) =>
      reuniaoVisivelParaUsuario(r, pessoaScope.pessoaId, donoPorReuniao)
    );
  }

  const mergeUsuarioId =
    pessoaScope.mode === "user" ? pessoaScope.pessoaId : null;

  let items = mergeCalendarioItems(
    eventosOutlook,
    reunioes,
    (atividadesRaw as AtividadeComPessoa[]) ?? [],
    donoPorReuniao,
    mergeUsuarioId
  );

  if (pessoaScope.mode === "all") {
    items = agruparReunioesDuplicadasAdmin(items);
  }

  const fotoPorPessoaId = new Map(pessoas.map((p) => [p.id, p.avatar_url]));
  items = items.map((item) => aplicarFotoDoCadastro(item, fotoPorPessoaId));

  const outlookVinculos = eventosOutlook
    .filter((e) => e.reuniao_id)
    .map((e) => ({
      reuniao_id: e.reuniao_id as string,
      pessoa_id: e.pessoa_id,
      status: e.status,
    }));

  return (
    <div className="space-y-4">
      <CalendarioAutoSync />
      {!outlookConfigurado() && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Credenciais da Microsoft não detectadas no ambiente. A sincronização
          automática não funcionará até configurar o <code>.env</code>.
        </p>
      )}
      <Suspense fallback={<ListPageSkeleton />}>
        <OutlookClient
          items={items}
          outlookVinculos={outlookVinculos}
          pessoas={pessoas ?? []}
          colaboradores={(colaboradores ?? []).map((c) => ({
            ...c,
            avatar_url: avatarDaPessoa(c.email, c.avatar_url, avatares),
          }))}
          tiposReuniao={tiposReuniao}
          verAgendaTodos={verAgendaTodos}
          verFiltroPessoas={pessoas.length > 1}
          pessoaAtualId={pessoa?.id ?? null}
          fellowAtivo={fellowConfigurado()}
          filtroInicial={filtroInicial}
          onboardingEnabled={!onboarding.calendarioConcluido}
          agendamentoTourEnabled={
            onboarding.calendarioConcluido &&
            pessoa?.onboarding_agendamento_concluido !== true
          }
        />
      </Suspense>
    </div>
  );
}

function comFoto<T extends { id: string; avatar_url?: string | null }>(
  pessoa: T | null | undefined,
  fotos: Map<string, string | null>
): T | null | undefined {
  if (!pessoa || !fotos.has(pessoa.id)) return pessoa;
  return { ...pessoa, avatar_url: fotos.get(pessoa.id) ?? null };
}

/** O evento guarda a foto do cadastro de usuários (site fora do ar). Troca pela resolvida. */
function aplicarFotoDoCadastro(
  item: CalendarioItem,
  fotos: Map<string, string | null>
): CalendarioItem {
  return {
    ...item,
    pessoa: comFoto(item.pessoa, fotos) ?? null,
    grupoPessoas: item.grupoPessoas?.map((p) => comFoto(p, fotos) ?? p),
    grupoReunioes: item.grupoReunioes?.map((g) => ({
      ...g,
      pessoa: comFoto(g.pessoa, fotos) ?? null,
    })),
    grupoOutlook: item.grupoOutlook?.map((g) => ({
      ...g,
      pessoa: comFoto(g.pessoa, fotos) ?? null,
      item: {
        ...g.item,
        pessoa: comFoto(g.item.pessoa, fotos) ?? null,
      },
    })),
    atividade: item.atividade
      ? {
          ...item.atividade,
          pessoa: comFoto(item.atividade.pessoa, fotos) ?? null,
          com_pessoa: comFoto(item.atividade.com_pessoa, fotos) ?? null,
        }
      : item.atividade,
  };
}
