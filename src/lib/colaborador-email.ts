import type { createClient } from "@/lib/supabase/server";
import { emailsEscritorioIguais } from "@/lib/email-escritorio";

/** Localiza colaborador ativo pelo e-mail (bpplaw = bismarchipires). */
export async function colaboradorIdPorEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
): Promise<string | null> {
  const alvo = email.trim();
  if (!alvo) return null;

  const { data } = await supabase
    .from("colaboradores")
    .select("id, email")
    .eq("ativo", true);

  const match = (data ?? []).find((c) =>
    emailsEscritorioIguais(c.email, alvo)
  );
  return match?.id ?? null;
}
