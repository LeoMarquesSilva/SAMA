import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { ReunioesClient } from "@/components/reunioes/ReunioesClient";
import { CalendarioPendenteBanner } from "@/components/calendario/CalendarioPendenteBanner";
import { countEventosPendentes } from "@/lib/calendario";
import type { ReuniaoComRelacoes } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; cliente?: string }>;
}) {
  const { novo, cliente } = await searchParams;
  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;

  const [{ data: reunioes }, { data: pessoas }] = await Promise.all([
    supabase
      .from("reunioes")
      .select(
        "*, cliente:pessoas(ci, nome), participantes:reuniao_participantes(pessoa_id, papel, pessoa:usuarios(id, nome, avatar_url, email))"
      )
      .order("data_hora_inicio", { ascending: false }),
    supabase
      .from("usuarios")
      .select("id, nome, avatar_url")
      .order("nome", { ascending: true }),
  ]);

  // Pré-seleção de cliente vinda da ficha do cliente (?cliente=<ci>).
  let prefillCliente: { ci: string; nome: string } | null = null;
  if (cliente) {
    const { data: c } = await supabase
      .from("pessoas")
      .select("ci, nome")
      .eq("ci", cliente)
      .maybeSingle();
    if (c) prefillCliente = c;
  }

  const pendentes = await countEventosPendentes(supabase, {
    pessoaId: pessoa?.id,
    isAdmin,
  });

  return (
    <div className="space-y-4">
      <CalendarioPendenteBanner pendentes={pendentes} />
      <ReunioesClient
        reunioes={(reunioes as ReuniaoComRelacoes[]) ?? []}
        pessoas={pessoas ?? []}
        autoNew={novo === "1"}
        prefillCliente={prefillCliente}
      />
    </div>
  );
}
