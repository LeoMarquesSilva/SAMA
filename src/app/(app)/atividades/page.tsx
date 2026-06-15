import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { AtividadesClient } from "@/components/atividades/AtividadesClient";
import { CalendarioPendenteBanner } from "@/components/calendario/CalendarioPendenteBanner";
import { countEventosPendentes } from "@/lib/calendario";
import type { AtividadeComPessoa } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AtividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const { novo } = await searchParams;
  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;

  // Admin vê tudo; demais veem apenas as próprias atividades.
  let query = supabase
    .from("atividades_internas")
    .select(
      "*, pessoa:usuarios!atividades_internas_pessoa_id_fkey(id, nome, avatar_url), com_pessoa:usuarios!atividades_internas_com_pessoa_id_fkey(id, nome, avatar_url)"
    )
    .order("data_hora_inicio", { ascending: false })
    .neq("tipo", "CIENCIA_NF");

  if (!isAdmin && pessoa?.id) {
    query = query.eq("pessoa_id", pessoa.id);
  }

  const [{ data: atividades }, { data: pessoas }] = await Promise.all([
    query,
    supabase.from("usuarios").select("id, nome, avatar_url").order("nome"),
  ]);

  const pendentes = await countEventosPendentes(supabase, {
    pessoaId: pessoa?.id,
    isAdmin,
  });

  return (
    <div className="space-y-4">
      <CalendarioPendenteBanner pendentes={pendentes} />
      <AtividadesClient
        atividades={(atividades as AtividadeComPessoa[]) ?? []}
        pessoas={pessoas ?? []}
        podeEscolherPessoa={isAdmin}
        pessoaAtualId={pessoa?.id ?? null}
        autoNew={novo === "1"}
      />
    </div>
  );
}
