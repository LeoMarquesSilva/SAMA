import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { ensureColaboradoresSync } from "@/lib/colaboradores";
import { OutlookClient } from "@/components/outlook/OutlookClient";
import { CalendarioAutoSync } from "@/components/calendario/CalendarioAutoSync";
import { calendarioEventQueryRange } from "@/lib/calendario";
import { parseCalendarioFiltroInicial } from "@/lib/dashboard-filtros";
import {
  buildDonoCalendarioMap,
  mergeCalendarioItems,
  reuniaoVisivelParaUsuario,
} from "@/lib/calendario-items";
import { outlookConfigurado } from "@/lib/graph";
import { fellowConfigurado } from "@/lib/fellow";
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
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;
  const { start, end } = calendarioEventQueryRange();

  let outlookQuery = supabase
    .from("outlook_eventos")
    .select("*, pessoa:usuarios(id, nome, email, avatar_url)")
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio", { ascending: true, nullsFirst: false });

  if (!isAdmin && pessoa?.id) {
    outlookQuery = outlookQuery.eq("pessoa_id", pessoa.id);
  }

  let reunioesQuery = supabase
    .from("reunioes")
    .select(
      "*, cliente:pessoas(ci, nome, grupo_cliente), participantes:reuniao_participantes(colaborador_id, papel, colaborador:colaboradores(id, nome, avatar_url, email, departamento, usuario_id))"
    )
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

  if (!isAdmin && pessoa?.id) {
    atividadesQuery = atividadesQuery.eq("pessoa_id", pessoa.id);
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

  const eventosOutlook = (eventos as OutlookEventoComPessoa[]) ?? [];
  const reunioesAll = (reunioesRaw as ReuniaoComRelacoes[]) ?? [];
  const donoPorReuniao = buildDonoCalendarioMap(eventosOutlook, reunioesAll);

  let reunioes = reunioesAll;
  if (!isAdmin && pessoa?.id) {
    reunioes = reunioes.filter((r) =>
      reuniaoVisivelParaUsuario(r, pessoa.id, donoPorReuniao)
    );
  }

  const items = mergeCalendarioItems(
    eventosOutlook,
    reunioes,
    (atividadesRaw as AtividadeComPessoa[]) ?? [],
    donoPorReuniao
  );

  return (
    <div className="space-y-4">
      <CalendarioAutoSync />
      {!outlookConfigurado() && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Credenciais da Microsoft não detectadas no ambiente. A sincronização
          automática não funcionará até configurar o <code>.env</code>.
        </p>
      )}
      <OutlookClient
        items={items}
        pessoas={pessoas ?? []}
        colaboradores={colaboradores ?? []}
        isAdmin={isAdmin}
        pessoaAtualId={pessoa?.id ?? null}
        fellowAtivo={fellowConfigurado()}
        filtroInicial={filtroInicial}
      />
    </div>
  );
}
