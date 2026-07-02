import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { ensureColaboradoresSync } from "@/lib/colaboradores";
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
} from "@/lib/calendario-items";
import { canViewAgendaTodos } from "@/lib/constants";
import { outlookConfigurado } from "@/lib/graph";
import { fellowConfigurado } from "@/lib/fellow";
import { getOnboardingFlags } from "@/lib/onboarding/state";
import type {
  AtividadeComPessoa,
  OutlookEventoComPessoa,
  ReuniaoComRelacoes,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filtroInicial = parseCalendarioFiltroInicial(sp);

  await ensureColaboradoresSync();

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
  const pessoa = await getPessoaAtual();
  const verAgendaTodos = canViewAgendaTodos(pessoa);
  const pessoaScope = resolveCalendarioPessoaScope(
    filtroInicial.pessoa,
    pessoa?.id ?? null,
    verAgendaTodos
  );
  const { start, end } = calendarioEventQueryRange();

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
    { data: pessoas },
    { data: colaboradores },
  ] = await Promise.all([
    outlookQuery,
    reunioesQuery,
    atividadesQuery,
    supabase.from("usuarios").select("id, nome, email, avatar_url").order("nome"),
    supabase
      .from("colaboradores")
      .select("id, nome, email, departamento, avatar_url, usuario_id")
      .eq("ativo", true)
      .order("nome"),
  ]);

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
          colaboradores={colaboradores ?? []}
          verAgendaTodos={verAgendaTodos}
          pessoaAtualId={pessoa?.id ?? null}
          fellowAtivo={fellowConfigurado()}
          filtroInicial={filtroInicial}
          onboardingEnabled={!onboarding.calendarioConcluido}
        />
      </Suspense>
    </div>
  );
}
