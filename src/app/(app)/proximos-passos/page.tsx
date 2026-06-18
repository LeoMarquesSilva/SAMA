import { createClient } from "@/lib/supabase/server";
import { ensureColaboradoresSync } from "@/lib/colaboradores";
import { ProximosPassosClient } from "@/components/proximos-passos/ProximosPassosClient";
import { agruparPassosReunioes, contarPassosTotais } from "@/lib/proximos-passos";
import type { ReuniaoComRelacoes } from "@/types/database";
import { fellowConfigurado } from "@/lib/fellow";

export const dynamic = "force-dynamic";

export default async function ProximosPassosPage() {
  await ensureColaboradoresSync();

  const supabase = await createClient();

  const [{ data: reunioesRaw }, { data: colaboradores }] = await Promise.all([
    supabase
      .from("reunioes")
      .select(
        "*, cliente:pessoas(ci, nome, grupo_cliente), participantes:reuniao_participantes(colaborador_id, papel, nome, email, colaborador:colaboradores(id, nome, avatar_url, email, departamento, usuario_id))"
      )
      .not("proximos_passos", "is", null)
      .neq("proximos_passos", "")
      .order("data_hora_inicio", { ascending: false }),
    supabase
      .from("colaboradores")
      .select("id, nome, email, departamento, avatar_url, usuario_id")
      .eq("ativo", true)
      .order("nome"),
  ]);

  const reunioes = (reunioesRaw as ReuniaoComRelacoes[]) ?? [];
  const grupos = agruparPassosReunioes(reunioes);
  const totais = contarPassosTotais(reunioes);

  return (
    <ProximosPassosClient
      grupos={grupos}
      totais={totais}
      colaboradores={colaboradores ?? []}
      fellowAtivo={fellowConfigurado()}
    />
  );
}
