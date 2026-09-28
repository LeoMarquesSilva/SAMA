import type { SupabaseClient } from "@supabase/supabase-js";

type Horario = {
  id: string;
  data_hora_inicio: string | null;
  data_hora_fim: string | null;
  duracao_minutos: number | null;
};

type EventoOutlook = {
  reuniao_id: string | null;
  atividade_id: string | null;
  inicio: string | null;
  fim: string | null;
  duracao_minutos: number | null;
};

const CHUNK = 150;
const CONCURRENCY = 8;

function mesmoInstante(a: string | null, b: string | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b;
  return ta === tb;
}

function horarioIgual(atual: Horario, inicio: string | null, fim: string | null, duracao: number | null) {
  return (
    mesmoInstante(atual.data_hora_inicio, inicio) &&
    mesmoInstante(atual.data_hora_fim, fim) &&
    (atual.duracao_minutos ?? null) === (duracao ?? null)
  );
}

async function carregarPorIds(
  supabase: SupabaseClient,
  table: "reunioes" | "atividades_internas",
  ids: string[]
): Promise<Horario[]> {
  const out: Horario[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from(table)
      .select("id, data_hora_inicio, data_hora_fim, duracao_minutos")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Horario[]));
  }
  return out;
}

async function mapPool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  const n = Math.min(CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

/**
 * Propaga início/fim/duração do Outlook só quando o horário do SAMA divergiu.
 * A sincronização automática roda isso em toda abertura do calendário.
 */
export async function alinharRegistrosComOutlook(
  supabase: SupabaseClient
): Promise<{ reunioes: number; atividades: number }> {
  const { data, error } = await supabase
    .from("outlook_eventos")
    .select("reuniao_id, atividade_id, inicio, fim, duracao_minutos, status")
    .in("status", ["CATEGORIZADO_REUNIAO", "CATEGORIZADO_ATIVIDADE"])
    .not("inicio", "is", null);

  if (error || !data?.length) {
    return { reunioes: 0, atividades: 0 };
  }

  const eventos = data as EventoOutlook[];
  const reuniaoIds = [
    ...new Set(eventos.map((e) => e.reuniao_id).filter((id): id is string => Boolean(id))),
  ];
  const atividadeIds = [
    ...new Set(eventos.map((e) => e.atividade_id).filter((id): id is string => Boolean(id))),
  ];

  const [reunioes, atividades] = await Promise.all([
    reuniaoIds.length ? carregarPorIds(supabase, "reunioes", reuniaoIds) : Promise.resolve([]),
    atividadeIds.length
      ? carregarPorIds(supabase, "atividades_internas", atividadeIds)
      : Promise.resolve([]),
  ]);

  const reuniaoPorId = new Map(reunioes.map((r) => [r.id, r]));
  const atividadePorId = new Map(atividades.map((a) => [a.id, a]));

  const updates: { table: "reunioes" | "atividades_internas"; id: string; inicio: string | null; fim: string | null; duracao: number | null }[] = [];

  for (const oe of eventos) {
    if (oe.reuniao_id) {
      const atual = reuniaoPorId.get(oe.reuniao_id);
      if (atual && !horarioIgual(atual, oe.inicio, oe.fim, oe.duracao_minutos)) {
        updates.push({
          table: "reunioes",
          id: oe.reuniao_id,
          inicio: oe.inicio,
          fim: oe.fim,
          duracao: oe.duracao_minutos,
        });
      }
    }
    if (oe.atividade_id) {
      const atual = atividadePorId.get(oe.atividade_id);
      if (atual && !horarioIgual(atual, oe.inicio, oe.fim, oe.duracao_minutos)) {
        updates.push({
          table: "atividades_internas",
          id: oe.atividade_id,
          inicio: oe.inicio,
          fim: oe.fim,
          duracao: oe.duracao_minutos,
        });
      }
    }
  }

  let reunioesAtualizadas = 0;
  let atividadesAtualizadas = 0;
  await mapPool(updates, async (u) => {
    const { error: upErr } = await supabase
      .from(u.table)
      .update({
        data_hora_inicio: u.inicio,
        data_hora_fim: u.fim,
        duracao_minutos: u.duracao,
      })
      .eq("id", u.id);
    if (upErr) return;
    if (u.table === "reunioes") reunioesAtualizadas += 1;
    else atividadesAtualizadas += 1;
  });

  return { reunioes: reunioesAtualizadas, atividades: atividadesAtualizadas };
}
