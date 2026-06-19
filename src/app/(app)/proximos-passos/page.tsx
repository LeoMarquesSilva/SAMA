import { createClient } from "@/lib/supabase/server";
import { ensureColaboradoresSync } from "@/lib/colaboradores";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { reuniaoMinhaClassificada } from "@/lib/calendario-items";
import { ProximosPassosClient } from "@/components/proximos-passos/ProximosPassosClient";
import { agruparPassosReunioes, contarPassosTotais } from "@/lib/proximos-passos";
import type { ReuniaoComRelacoes } from "@/types/database";
import { fellowConfigurado } from "@/lib/fellow";
import { getOnboardingFlags } from "@/lib/onboarding/state";

export const dynamic = "force-dynamic";

export default async function ProximosPassosPage() {
  await ensureColaboradoresSync();

  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const onboarding = user
    ? await getOnboardingFlags(supabase, user.id)
    : {
        calendarioConcluido: true,
        dashboardConcluido: true,
        proximosPassosConcluido: true,
      };

  const [{ data: reunioesRaw }, { data: colaboradores }, { data: outlookRaw }] =
    await Promise.all([
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
      pessoa
        ? supabase
            .from("outlook_eventos")
            .select("reuniao_id, pessoa_id, status")
            .eq("pessoa_id", pessoa.id)
            .not("reuniao_id", "is", null)
        : Promise.resolve({ data: [] as { reuniao_id: string; pessoa_id: string; status: string }[] }),
    ]);

  const outlookVinculos = outlookRaw ?? [];
  const reunioes = ((reunioesRaw as ReuniaoComRelacoes[]) ?? []).filter((r) =>
    pessoa ? reuniaoMinhaClassificada(r, pessoa.id, outlookVinculos) : false
  );
  const grupos = agruparPassosReunioes(reunioes);
  const totais = contarPassosTotais(reunioes);

  return (
    <ProximosPassosClient
      grupos={grupos}
      totais={totais}
      colaboradores={colaboradores ?? []}
      fellowAtivo={fellowConfigurado()}
      onboardingEnabled={!onboarding.proximosPassosConcluido}
    />
  );
}
