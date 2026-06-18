"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingTourId } from "@/lib/onboarding/types";

export async function concluirOnboardingTour(
  tour: OnboardingTourId
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("concluir_onboarding", { tour });

  if (error) {
    // Migration 0038 ainda não aplicada — não bloqueia o usuário.
    if (
      error.message.includes("concluir_onboarding") ||
      error.message.includes("onboarding_")
    ) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath("/proximos-passos");
  return { ok: true };
}
