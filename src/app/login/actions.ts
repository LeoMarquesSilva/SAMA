"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  countEventosPendentes,
  landingPathComOnboarding,
  agendaPendentesQueryOpts,
} from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";
import { countPassosPendentes } from "@/lib/proximos-passos";
import { setAlertasLoginCookie } from "@/lib/alertas-login";

export type LoginState = { error?: string; redirectTo?: string };

export type RecuperarSenhaState = { error?: string; success?: string };

const MENSAGEM_RECUPERACAO_ENVIADA =
  "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos. Verifique também a caixa de spam.";

function recuperacaoRedirectUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/auth/callback?next=/redefinir-senha`;
}

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
    .select("id, ativo, senha_provisoria, cargo, departamento, is_admin")
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
    return { redirectTo: "/trocar-senha" };
  }

  // A sincronização do Outlook não roda mais no login (era bloqueante).
  // Ela acontece ao abrir a tela do calendário (CalendarioAutoSync, throttle 5 min).
  const pendentes = await countEventosPendentes(
    supabase,
    agendaPendentesQueryOpts(perfil)
  );
  const passosPendentes = await countPassosPendentes(supabase, {
    pessoaId: perfil.id,
  });

  if (pendentes > 0 || passosPendentes > 0) {
    await setAlertasLoginCookie();
  }

  const onboarding = await getOnboardingFlags(supabase, user.id);

  return {
    redirectTo: landingPathComOnboarding({
      cargo: perfil.cargo,
      pendentes,
      onboardingCalendarioConcluido: onboarding.calendarioConcluido,
    }),
  };
}

export async function solicitarRecuperacaoSenha(
  _prev: RecuperarSenhaState,
  formData: FormData
): Promise<RecuperarSenhaState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Informe seu e-mail corporativo." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "Recuperação de senha indisponível no momento. Contate o administrador.",
    };
  }

  const admin = createAdminClient();
  const { data: pessoa } = await admin
    .from("usuarios")
    .select("ativo, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!pessoa?.ativo || !pessoa.auth_user_id) {
    return { success: MENSAGEM_RECUPERACAO_ENVIADA };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: recuperacaoRedirectUrl(),
  });

  if (error) {
    console.error("[recuperar-senha]", error.message);
  }

  return { success: MENSAGEM_RECUPERACAO_ENVIADA };
}
