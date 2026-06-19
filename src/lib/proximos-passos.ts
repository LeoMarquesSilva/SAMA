import type { SupabaseClient } from "@supabase/supabase-js";
import { reuniaoMinhaClassificada } from "@/lib/calendario-items";
import {
  contarProximosPassosPendentes,
  parseChecklist,
  serializeChecklist,
  type ChecklistItem,
} from "@/lib/proximos-passos-checklist";
import type { ReuniaoComRelacoes, TipoReuniao } from "@/types/database";

export const PROXIMOS_PASSOS_PATH = "/proximos-passos";

export type PassoReuniaoItem = {
  reuniaoId: string;
  reuniaoTitulo: string;
  reuniaoTipo: TipoReuniao;
  reuniaoData: string;
  clienteNome: string | null;
  itemIndex: number;
  text: string;
  done: boolean;
};

export type PassoReuniaoGrupo = {
  reuniao: ReuniaoComRelacoes;
  itens: PassoReuniaoItem[];
  pendentes: number;
  realizados: number;
};

export function expandirPassosReuniao(r: ReuniaoComRelacoes): PassoReuniaoItem[] {
  const itens = parseChecklist(r.proximos_passos).filter(
    (item) => item.text.trim().length > 0
  );
  const clienteNome =
    r.cliente?.grupo_cliente ?? r.cliente?.nome ?? null;

  return itens.map((item, itemIndex) => ({
    reuniaoId: r.id,
    reuniaoTitulo: r.titulo,
    reuniaoTipo: r.tipo,
    reuniaoData: r.data_hora_inicio,
    clienteNome,
    itemIndex,
    text: item.text,
    done: item.done,
  }));
}

export function agruparPassosReunioes(
  reunioes: ReuniaoComRelacoes[]
): PassoReuniaoGrupo[] {
  return reunioes
    .map((reuniao) => {
      const itens = expandirPassosReuniao(reuniao);
      if (itens.length === 0) return null;
      const pendentes = itens.filter((i) => !i.done).length;
      const realizados = itens.filter((i) => i.done).length;
      return { reuniao, itens, pendentes, realizados };
    })
    .filter((g): g is PassoReuniaoGrupo => g !== null)
    .sort(
      (a, b) =>
        new Date(b.reuniao.data_hora_inicio).getTime() -
        new Date(a.reuniao.data_hora_inicio).getTime()
    );
}

export function toggleItemChecklist(
  raw: string | null | undefined,
  itemIndex: number,
  done: boolean
): string {
  const items = parseChecklist(raw).filter((item) => item.text.trim().length > 0);
  if (itemIndex < 0 || itemIndex >= items.length) {
    throw new Error("Item não encontrado.");
  }
  const next: ChecklistItem[] = items.map((item, i) =>
    i === itemIndex ? { ...item, done } : item
  );
  return serializeChecklist(next);
}

export function contarPassosTotais(reunioes: ReuniaoComRelacoes[]): {
  pendentes: number;
  realizados: number;
} {
  let pendentes = 0;
  let realizados = 0;
  for (const r of reunioes) {
    const items = parseChecklist(r.proximos_passos).filter(
      (item) => item.text.trim().length > 0
    );
    for (const item of items) {
      if (item.done) realizados++;
      else pendentes++;
    }
  }
  return { pendentes, realizados };
}

/** Conta passos pendentes das reuniões classificadas pelo usuário (não todas, mesmo admin). */
export async function countPassosPendentes(
  supabase: SupabaseClient,
  opts: { pessoaId?: string | null } = {}
): Promise<number> {
  const pessoaId = opts.pessoaId;
  if (!pessoaId) return 0;

  const [{ data: reunioesRaw }, { data: outlookRaw }] = await Promise.all([
    supabase
      .from("reunioes")
      .select("id, criado_por_id, proximos_passos")
      .not("proximos_passos", "is", null)
      .neq("proximos_passos", ""),
    supabase
      .from("outlook_eventos")
      .select("reuniao_id, pessoa_id, status")
      .eq("pessoa_id", pessoaId)
      .not("reuniao_id", "is", null),
  ]);

  const outlook = outlookRaw ?? [];
  let total = 0;
  for (const row of reunioesRaw ?? []) {
    if (!reuniaoMinhaClassificada(row, pessoaId, outlook)) continue;
    total += contarProximosPassosPendentes(row.proximos_passos);
  }
  return total;
}
