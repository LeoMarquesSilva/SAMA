import { createClient } from "@/lib/supabase/server";
import type { Pessoa } from "@/types/database";

/** Retorna a Pessoa vinculada ao usuário logado (ou null). */
export async function getPessoaAtual(): Promise<Pessoa | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (data as Pessoa) ?? null;
}
