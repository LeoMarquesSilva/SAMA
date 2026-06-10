"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sincronizarCalendarioAutomatico } from "@/app/(app)/calendario/actions";
import { countEventosPendentes, landingPath } from "@/lib/calendario";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciais inválidas. Verifique e-mail e senha." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não foi possível validar a sessão." };
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, ativo, senha_provisoria, cargo, is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!perfil) {
    await supabase.auth.signOut();
    return {
      error:
        "Seu login não está vinculado a um usuário do SAMA. Peça ao administrador para ativar seu acesso.",
    };
  }

  if (!perfil.ativo) {
    await supabase.auth.signOut();
    return {
      error:
        "Seu acesso está desativado. Peça ao administrador para reativar seu login.",
    };
  }

  if (perfil.senha_provisoria) {
    redirect("/trocar-senha");
  }

  await sincronizarCalendarioAutomatico();

  const pendentes = await countEventosPendentes(supabase, {
    pessoaId: perfil.id,
    isAdmin: perfil.is_admin,
  });

  redirect(landingPath(perfil.cargo, pendentes));
}
