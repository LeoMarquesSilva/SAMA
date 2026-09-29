import { cache } from "react";
import { headers } from "next/headers";
import { AUTH_USER_ID_HEADER } from "@/lib/auth-header";
import { createClient } from "@/lib/supabase/server";
import type { Pessoa } from "@/types/database";

/** Retorna a Pessoa vinculada ao usuário logado (ou null). Memoizado por requisição. */
export const getPessoaAtual = cache(async (): Promise<Pessoa | null> => {
  const supabase = await createClient();
  // O middleware já validou a sessão e repassou o id; sem ele, valida aqui.
  let authUserId = (await headers()).get(AUTH_USER_ID_HEADER);
  if (!authUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUserId = user?.id ?? null;
  }
  if (!authUserId) return null;

  // RLS continua valendo: a consulta usa o token da sessão (cookies).
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", authUserId)
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
