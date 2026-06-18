import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingFlags = {
  calendarioConcluido: boolean;
  dashboardConcluido: boolean;
  proximosPassosConcluido: boolean;
};

const DEFAULT_ONBOARDING: OnboardingFlags = {
  calendarioConcluido: true,
  dashboardConcluido: true,
  proximosPassosConcluido: true,
};

/** Lê flags de onboarding; se a migration ainda não foi aplicada, assume concluído. */
export async function getOnboardingFlags(
  supabase: SupabaseClient,
  authUserId: string
): Promise<OnboardingFlags> {
  const { data, error } = await supabase
    .from("usuarios")
    .select(
      "onboarding_calendario_concluido, onboarding_dashboard_concluido, onboarding_proximos_passos_concluido"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) return DEFAULT_ONBOARDING;

  return {
    calendarioConcluido: data.onboarding_calendario_concluido ?? true,
    dashboardConcluido: data.onboarding_dashboard_concluido ?? true,
    proximosPassosConcluido: data.onboarding_proximos_passos_concluido ?? true,
  };
}
