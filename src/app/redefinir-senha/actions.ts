"use server";

import { createClient } from "@/lib/supabase/server";
import {
  countEventosPendentes,
  landingPathComOnboarding,
  agendaPendentesQueryOpts,
} from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";

export type RedefinirSenhaState = {
  error?: string;
  redirectTo?: string;
  /** O token do e-mail já virou sessão; os próximos envios vão sem ele. */
  tokenUsado?: boolean;
};

const LINK_INVALIDO =
  "Este link expirou ou já foi usado. Volte ao login e peça um novo e-mail em “Esqueci minha senha”.";

export async function redefinirSenha(
  prev: RedefinirSenhaState,
  formData: FormData
): Promise<RedefinirSenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const tokenUsado = Boolean(prev.tokenUsado);

  if (senha.length < 6) {
    return { error: "A nova senha deve ter ao menos 6 caracteres.", tokenUsado };
  }
  if (senha === "123456") {
    return { error: "Escolha uma senha diferente da padrão (123456).", tokenUsado };
  }
  if (senha !== confirmacao) {
    return { error: "As senhas não conferem.", tokenUsado };
  }

  const supabase = await createClient();

  // O link do e-mail traz o token: ele só vira sessão aqui, ao salvar.
  if (tokenHash) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (otpError) {
      console.error("[redefinir-senha] verifyOtp:", otpError.message);
      return { error: LINK_INVALIDO };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: LINK_INVALIDO, redirectTo: "/login?erro=recuperacao" };
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    const motivo =
      error.code === "same_password"
        ? "A nova senha precisa ser diferente da atual."
        : error.code === "weak_password"
          ? "Essa senha é fraca demais. Escolha outra."
          : "Não foi possível definir a nova senha. Tente novamente.";
    return { error: motivo, tokenUsado: true };
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
