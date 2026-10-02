import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { tiposReuniaoPadrao, type TipoReuniaoItem } from "@/lib/reuniao-tipos";

const SELECT_TIPOS =
  "chave, label, descricao, ativo, grupo_interno, cor, ordem";

function ordenar(tipos: TipoReuniaoItem[]): TipoReuniaoItem[] {
  return [...tipos].sort(
    (a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label, "pt-BR")
  );
}

/** Todos os tipos cadastrados (ativos e fora de uso). Memoizado por requisição. */
export const listarTiposReuniao = cache(async (): Promise<TipoReuniaoItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reuniao_tipos")
    .select(SELECT_TIPOS);

  // Tabela ausente ou ilegível: segue com a lista do código.
  if (error || !data?.length) return ordenar(tiposReuniaoPadrao());

  return ordenar(
    data.map((t) => ({
      chave: t.chave,
      label: t.label,
      descricao: t.descricao ?? "",
      ativo: t.ativo !== false,
      grupo_interno: t.grupo_interno === true,
      cor: t.cor ?? null,
      ordem: t.ordem ?? 0,
    }))
  );
});
