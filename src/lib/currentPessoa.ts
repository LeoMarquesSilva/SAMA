import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Pessoa } from "@/types/database";

/** Retorna a Pessoa vinculada ao usuário logado (ou null). Memoizado por requisição. */
export const getPessoaAtual = cache(async (): Promise<Pessoa | null> => {
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
});

/** Módulos liberados para o usuário logado (usuario_modulos). Memoizado por requisição. */
export const getModulosAtuais = cache(async (): Promise<string[]> => {
  const pessoa = await getPessoaAtual();
  if (!pessoa) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuario_modulos")
    .select("modulo")
    .eq("usuario_id", pessoa.id);
  return (data ?? []).map((r) => r.modulo as string);
});
