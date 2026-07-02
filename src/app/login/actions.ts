"use server";

import { createClient } from "@/lib/supabase/server";
import {
  countEventosPendentes,
  landingPathComOnboarding,
  agendaPendentesQueryOpts,
} from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";
import { countPassosPendentes } from "@/lib/proximos-passos";
import { setAlertasLoginCookie } from "@/lib/alertas-login";

export type LoginState = { error?: string; redirectTo?: string };

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
