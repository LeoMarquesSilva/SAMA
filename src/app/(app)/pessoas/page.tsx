import { createClient } from "@/lib/supabase/server";
import { requireUsuariosAccess } from "@/lib/auth";
import { authLastSignInByUserId } from "@/lib/auth-users.server";
import { PessoasClient } from "@/components/pessoas/PessoasClient";
import type { Pessoa } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const eu = await requireUsuariosAccess();

  const { novo } = await searchParams;
  const supabase = await createClient();
  const [{ data }, lastSignIn] = await Promise.all([
    supabase.from("usuarios").select("*").order("nome", { ascending: true }),
    authLastSignInByUserId(),
  ]);

  const pessoas: Pessoa[] = ((data as Pessoa[]) ?? []).map((p) => ({
    ...p,
    ultimo_acesso_em: p.auth_user_id
      ? (lastSignIn.get(p.auth_user_id) ?? null)
      : null,
  }));

  return (
    <PessoasClient
      pessoas={pessoas}
      autoNew={novo === "1"}
      isAdmin={eu.is_admin}
      showUltimoAcesso={eu.is_admin}
    />
  );
}
