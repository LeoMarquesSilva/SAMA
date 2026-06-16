import { requireAdmin } from "@/lib/auth";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { createClient } from "@/lib/supabase/server";
import { TarefasClient } from "@/components/tarefas/TarefasClient";
import { viosConfigurado } from "@/lib/vios";
import { getTarefasSyncInfo } from "@/app/(app)/tarefas/actions";
import type { ViosTarefaRow } from "@/types/database";
import type { ColaboradorOpt } from "@/lib/colaboradores";

export const dynamic = "force-dynamic";

const EMPTY_TAREFAS_ID = "00000000-0000-0000-0000-000000000000";

export default async function TarefasPage() {
  await requireAdmin();
  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;

  const [{ data: sociosArea }, syncInfo, { data: usuarios }, { data: colaboradores }] =
    await Promise.all([
      supabase.from("usuarios").select("id").eq("cargo", "SOCIO_AREA"),
      getTarefasSyncInfo(),
      supabase
        .from("usuarios")
        .select("id, nome, email, avatar_url")
        .order("nome"),
      supabase
        .from("colaboradores")
        .select("id, nome, email, departamento, avatar_url, usuario_id")
        .eq("ativo", true)
        .order("nome"),
    ]);

  const socioAreaIds = (sociosArea ?? []).map((u) => u.id);

  let tarefasQuery = supabase
    .from("vios_tarefas")
    .select("*")
    .order("data_conclusao", { ascending: false, nullsFirst: false })
    .order("data_limite", { ascending: true, nullsFirst: false });

  if (socioAreaIds.length === 0) {
    tarefasQuery = tarefasQuery.eq("id", EMPTY_TAREFAS_ID);
  } else {
    tarefasQuery = tarefasQuery.in("usuario_concluiu_id", socioAreaIds);
  }

  const { data: tarefas } = await tarefasQuery;

  const ultimaSync =
    tarefas && tarefas.length > 0
      ? tarefas.reduce((max, t) => {
          const s = (t as ViosTarefaRow).sincronizado_em;
          return s > max ? s : max;
        }, "")
      : syncInfo.estado?.ultima_sincronia ?? null;

  const pessoasAvatar = [
    ...(usuarios ?? []),
    ...(colaboradores ?? []).filter(
      (c) => !(usuarios ?? []).some((u) => u.nome === c.nome)
    ),
  ];

  return (
    <TarefasClient
      tarefas={(tarefas as ViosTarefaRow[]) ?? []}
      viosOk={viosConfigurado()}
      ultimaSync={ultimaSync || null}
      syncInfo={syncInfo}
      pessoas={pessoasAvatar}
      usuarios={usuarios ?? []}
      colaboradores={(colaboradores as ColaboradorOpt[]) ?? []}
      isAdmin={isAdmin}
      pessoaAtualId={pessoa?.id ?? null}
    />
  );
}
