import type { SupabaseClient } from "@supabase/supabase-js";
import type { CargoPessoa } from "@/lib/constants";

export const CALENDARIO_PATH = "/calendario";

/** Conta eventos do calendário aguardando categorização. */
export async function countEventosPendentes(
  supabase: SupabaseClient,
  opts: { pessoaId?: string | null; isAdmin?: boolean }
): Promise<number> {
  let q = supabase
    .from("outlook_eventos")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDENTE");
  if (!opts.isAdmin && opts.pessoaId) {
    q = q.eq("pessoa_id", opts.pessoaId);
  }
  const { count } = await q;
  return count ?? 0;
}

/** Rota inicial após login — sócio de área com pendências vai direto ao calendário. */
export function landingPath(
  cargo: CargoPessoa | undefined,
  pendentes: number
): string {
  if (cargo === "SOCIO_AREA" && pendentes > 0) return CALENDARIO_PATH;
  return "/dashboard";
}
