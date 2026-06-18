"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countEventosPendentes } from "@/lib/calendario";
import { countPassosPendentes } from "@/lib/proximos-passos";
import { setAlertasLoginCookie } from "@/lib/alertas-login";
import { getOnboardingFlags } from "@/lib/onboarding/state";

export type TrocaSenhaState = { error?: string };

export async function trocarSenha(
  _prev: TrocaSenhaState,
  formData: FormData
): Promise<TrocaSenhaState> {
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
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  const { error: rpcError } = await supabase.rpc("clear_senha_provisoria");
  if (rpcError) {
    return {
      error:
        "Senha alterada, mas não foi possível concluir a ativação. Contate o administrador.",
    };
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const onboarding = await getOnboardingFlags(supabase, user.id);

  if (perfil) {
    const [pendentes, passosPendentes] = await Promise.all([
      countEventosPendentes(supabase, {
        pessoaId: perfil.id,
        isAdmin: perfil.is_admin,
      }),
      countPassosPendentes(supabase, {
        pessoaId: perfil.id,
        isAdmin: perfil.is_admin,
      }),
    ]);

    if (pendentes > 0 || passosPendentes > 0) {
      await setAlertasLoginCookie();
    }
  }

  redirect(
    !onboarding.calendarioConcluido ? "/calendario" : "/dashboard"
  );
}
