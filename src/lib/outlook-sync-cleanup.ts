import type { SupabaseClient } from "@supabase/supabase-js";

export type OutlookOrphanCleanupResult = {
  removidos: number;
  reunioesRemovidas: number;
  atividadesRemovidas: number;
};

type EventoNoBanco = {
  id: string;
  outlook_event_id: string;
  reuniao_id: string | null;
  atividade_id: string | null;
};

const CAMPOS_DATA = new Set(["inicio", "fim"]);

/** JSON com chaves ordenadas: o jsonb do Postgres não preserva a ordem do objeto enviado. */
function jsonEstavel(v: unknown): string {
  if (v === undefined || v === null) return "null";
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonEstavel(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function mesmoValor(campo: string, a: unknown, b: unknown): boolean {
  if (CAMPOS_DATA.has(campo) && a && b) {
    return new Date(a as string).getTime() === new Date(b as string).getTime();
  }
  return jsonEstavel(a) === jsonEstavel(b);
}

/**
 * Mantém só os eventos do Graph que são novos ou mudaram em relação ao banco.
 * Regravar linhas idênticas gera eventos Realtime (recarregando a tela de
 * outros usuários) e escrita em disco sem necessidade.
 */
export function eventosNovosOuAlterados<T extends { outlook_event_id: string }>(
  doGraph: T[],
  noBanco: Record<string, unknown>[]
): T[] {
  const porId = new Map(noBanco.map((e) => [e.outlook_event_id as string, e]));
  return doGraph.filter((novo) => {
    const atual = porId.get(novo.outlook_event_id);
    if (!atual) return true;
    return Object.entries(novo).some(
      ([campo, valor]) => !mesmoValor(campo, valor, atual[campo])
    );
  });
}

/** IDs de eventos no SAMA que não voltaram do Graph na janela sincronizada. */
export function idsEventosOrfaos(
  noBanco: Pick<EventoNoBanco, "id" | "outlook_event_id">[],
  idsNoGraph: ReadonlySet<string>
): string[] {
  return noBanco
    .filter((e) => !idsNoGraph.has(e.outlook_event_id))
    .map((e) => e.id);
}

async function limparRegistrosSemVinculoOutlook(
  db: SupabaseClient,
  reuniaoIds: string[],
  atividadeIds: string[]
): Promise<{ reunioesRemovidas: number; atividadesRemovidas: number }> {
  let reunioesRemovidas = 0;
  let atividadesRemovidas = 0;

  for (const reuniaoId of reuniaoIds) {
    const { count } = await db
      .from("outlook_eventos")
      .select("id", { count: "exact", head: true })
      .eq("reuniao_id", reuniaoId);
    if (count !== 0) continue;

    const { data } = await db
      .from("reunioes")
      .delete()
      .eq("id", reuniaoId)
      .select("id");
    if (data?.length) reunioesRemovidas += data.length;
  }

  for (const atividadeId of atividadeIds) {
    const { count } = await db
      .from("outlook_eventos")
      .select("id", { count: "exact", head: true })
      .eq("atividade_id", atividadeId);
    if (count !== 0) continue;

    const { data } = await db
      .from("atividades_internas")
      .delete()
      .eq("id", atividadeId)
      .select("id");
    if (data?.length) atividadesRemovidas += data.length;
  }

  return { reunioesRemovidas, atividadesRemovidas };
}

/**
 * Remove do SAMA eventos Outlook que sumiram do Graph na janela sincronizada.
 * Outlook é a fonte da verdade: upsert + remoção de órfãos a cada sync.
 */
export async function removerEventosOrfaosOutlook(
  supabase: SupabaseClient,
  opts: {
    pessoaId: string;
    syncStart: string;
    syncEnd: string;
    graphOutlookEventIds: string[];
    /** Preferir service role para excluir reuniões/atividades sem vínculo. */
    admin?: SupabaseClient | null;
  }
): Promise<OutlookOrphanCleanupResult> {
  const idsNoGraph = new Set(opts.graphOutlookEventIds);

  const { data: noBanco, error } = await supabase
    .from("outlook_eventos")
    .select("id, outlook_event_id, reuniao_id, atividade_id")
    .eq("pessoa_id", opts.pessoaId)
    .gte("inicio", opts.syncStart)
    .lte("inicio", opts.syncEnd);

  if (error) {
    throw new Error(error.message);
  }

  if (!noBanco?.length) {
    return { removidos: 0, reunioesRemovidas: 0, atividadesRemovidas: 0 };
  }

  const orphanIds = idsEventosOrfaos(noBanco, idsNoGraph);
  if (orphanIds.length === 0) {
    return { removidos: 0, reunioesRemovidas: 0, atividadesRemovidas: 0 };
  }

  const orfaos = noBanco.filter((e) => orphanIds.includes(e.id));
  const reuniaoIds = [
    ...new Set(
      orfaos.map((e) => e.reuniao_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const atividadeIds = [
    ...new Set(
      orfaos
        .map((e) => e.atividade_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: removidos, error: delErr } = await supabase
    .from("outlook_eventos")
    .delete()
    .in("id", orphanIds)
    .select("id");

  if (delErr) {
    throw new Error(delErr.message);
  }

  const dbLimpeza = opts.admin ?? supabase;
  const { reunioesRemovidas, atividadesRemovidas } =
    await limparRegistrosSemVinculoOutlook(dbLimpeza, reuniaoIds, atividadeIds);

  return {
    removidos: removidos?.length ?? 0,
    reunioesRemovidas,
    atividadesRemovidas,
  };
}
