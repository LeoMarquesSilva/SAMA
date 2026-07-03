"use server";

import { createClient } from "@/lib/supabase/server";
import {
  countEventosPendentes,
  landingPathComOnboarding,
  agendaPendentesQueryOpts,
} from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";

export type RedefinirSenhaState = { error?: string; redirectTo?: string };

export async function redefinirSenha(
  _prev: RedefinirSenhaState,
  formData: FormData
): Promise<RedefinirSenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 6) {
    return { error: "A nova senha deve ter ao menos 6 caracteres." };
  }
  if (senha === "123456") {
    return { error: "Escolha uma senha diferente da padrão (123456)." };
  }
  if (senha !== confirmacao) {
    return { error: "As senhas não conferem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Link expirado ou inválido. Volte ao login e solicite um novo e-mail de recuperação.",
      redirectTo: "/login",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return { error: "Não foi possível definir a nova senha. Tente novamente." };
  }

  await supabase.rpc("clear_senha_provisoria");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, cargo, departamento, is_admin, ativo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    return { redirectTo: "/login?erro=inativo" };
  }

  const pendentes = await countEventosPendentes(
    supabase,
    agendaPendentesQueryOpts(perfil)
  );
  const onboarding = await getOnboardingFlags(supabase, user.id);

  return {
    redirectTo: landingPathComOnboarding({
      cargo: perfil.cargo,
      pendentes,
      onboardingCalendarioConcluido: onboarding.calendarioConcluido,
    }),
  };
}
