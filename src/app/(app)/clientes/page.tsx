import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "@/components/clientes/ClientesClient";
import type { GrupoClienteResumo } from "@/types/database";

export const dynamic = "force-dynamic";

const POR_PAGINA = 24;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);

  const supabase = await createClient();

  let grupoKeys: string[] | null = null;

  if (q.length >= 2) {
    const safe = q.replace(/[,()]/g, " ").trim();
    const like = `%${safe}%`;

    const { data: matches } = await supabase
      .from("escritorio_empresas_por_grupo")
      .select("grupo_cliente")
      .or(
        `nome.ilike.${like},cpf_cnpj.ilike.${like},grupo_cliente.ilike.${like}`
      )
      .limit(400);

    grupoKeys = [
      ...new Set((matches ?? []).map((m) => m.grupo_cliente ?? "")),
    ];
  }

  let query = supabase
    .from("escritorio_grupos_resumo")
    .select("grupo_cliente, total_empresas, total_geral, horas_total", {
      count: "exact",
    })
    .order("total_empresas", { ascending: false });

  if (q.length >= 2) {
    const safe = q.replace(/[,()]/g, " ").trim();
    const like = `%${safe}%`;
    const parts = [`grupo_cliente.ilike.${like}`];
    if (grupoKeys && grupoKeys.length > 0) {
      const quoted = grupoKeys
        .map((k) => `"${k.replace(/"/g, '\\"')}"`)
        .join(",");
      parts.push(`grupo_cliente.in.(${quoted})`);
    }
    query = query.or(parts.join(","));
  }

  const { data, count } = await query.range(
    (pagina - 1) * POR_PAGINA,
    pagina * POR_PAGINA - 1
  );

  const grupos: GrupoClienteResumo[] = (data ?? []).map((g) => ({
    grupo_cliente: g.grupo_cliente ?? "",
    total_empresas: g.total_empresas ?? 0,
    total_geral: g.total_geral ?? 0,
    horas_total: Number(g.horas_total ?? 0),
  }));

  return (
    <ClientesClient
      grupos={grupos}
      total={count ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      q={q}
    />
  );
}
