import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PessoasClient } from "@/components/pessoas/PessoasClient";
import type { Pessoa } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  await requireAdmin();

  const { novo } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .order("nome", { ascending: true });

  return (
    <PessoasClient
      pessoas={(data as Pessoa[]) ?? []}
      autoNew={novo === "1"}
      isAdmin
    />
  );
}
