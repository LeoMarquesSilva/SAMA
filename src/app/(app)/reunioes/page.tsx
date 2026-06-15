import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { ensureColaboradoresSync } from "@/lib/colaboradores";
import { ReunioesClient } from "@/components/reunioes/ReunioesClient";
import { CalendarioPendenteBanner } from "@/components/calendario/CalendarioPendenteBanner";
import { countEventosPendentes } from "@/lib/calendario";
import { fellowConfigurado } from "@/lib/fellow";
import type { ReuniaoComRelacoes } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; cliente?: string }>;
}) {
  const { novo, cliente } = await searchParams;
  await ensureColaboradoresSync();

  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;

  const [{ data: reunioes }, { data: colaboradores }] = await Promise.all([
    supabase
      .from("reunioes")
      .select(
        "*, cliente:pessoas(ci, nome, grupo_cliente), participantes:reuniao_participantes(colaborador_id, papel, colaborador:colaboradores(id, nome, avatar_url, email, departamento, usuario_id))"
      )
      .order("data_hora_inicio", { ascending: false }),
    supabase
      .from("colaboradores")
      .select("id, nome, email, departamento, avatar_url, usuario_id")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);

  // Pré-seleção de cliente vinda da ficha do cliente (?cliente=<ci>).
  let prefillCliente: {
    ci: string;
    nome: string;
    grupo_cliente: string | null;
  } | null = null;
  if (cliente) {
    const { data: c } = await supabase
      .from("pessoas")
      .select("ci, nome, grupo_cliente")
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
        colaboradores={colaboradores ?? []}
        autoNew={novo === "1"}
        prefillCliente={prefillCliente}
        fellowAtivo={fellowConfigurado()}
      />
    </div>
  );
}
