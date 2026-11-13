import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { startOfDayInstantInTz } from "@/lib/timezone";
import {
  isClusterAgenda,
  isGrupoInternoAgenda,
  mesKeyInTz,
  somarMeses,
  type AgendaPositivaCliente,
} from "@/lib/agenda-positiva";

const PAGINA = 1000;

/** Clientes com cluster e meta. semTabela: a migration 0057 ainda não foi aplicada. */
export async function listarAgendaPositiva(): Promise<{
  clientes: AgendaPositivaCliente[];
  semTabela: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_positiva_clientes")
    .select("grupo_cliente, cluster, meta_mensal")
    .order("cluster")
    .order("grupo_cliente");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { clientes: [], semTabela: true };
    }
    throw new Error(error.message);
  }
  const clientes = (data ?? []).flatMap((r) =>
    isClusterAgenda(r.cluster)
      ? [{ grupo_cliente: r.grupo_cliente, cluster: r.cluster, meta_mensal: r.meta_mensal }]
      : []
  );
  return { clientes, semTabela: false };
}

/**
 * Todos os grupos cliente do escritório (os mesmos da tela Clientes), com ou sem
 * cluster na agenda. Fora: cadastros sem grupo e os grupos internos do escritório.
 * Service role pelo mesmo motivo de reunioesPorCliente: a lista é do escritório.
 */
export async function listarGruposCliente(): Promise<string[]> {
  const admin = createAdminClient();
  const grupos: string[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await admin
      .from("escritorio_grupos_resumo")
      .select("grupo_cliente")
      .order("grupo_cliente")
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const g = (r.grupo_cliente ?? "").trim();
      if (g && !isGrupoInternoAgenda(g)) grupos.push(g);
    }
    if ((data?.length ?? 0) < PAGINA) break;
  }
  return [...new Set(grupos)];
}

export type ReuniaoDoCliente = {
  /** grupo_cliente do cliente; sem grupo, o nome do cliente. */
  cliente: string;
  mes: string;
  inicio: string;
  status: string;
  tipo: string;
};

/**
 * Reuniões não canceladas entre o 1º dia de `mesDe` e o último de `mesAte`, de
 * todo o escritório. Usa a service role porque a Agenda Positiva mede a cobertura
 * do cliente, não a agenda de quem está olhando — o acesso é o módulo
 * agenda-positiva, e a tela só mostra contagens e datas.
 */
export async function reunioesPorCliente(
  mesDe: string,
  mesAte: string,
  opts: { tipo?: string } = {}
): Promise<ReuniaoDoCliente[]> {
  const de = new Date(startOfDayInstantInTz(`${mesDe}-01`)).toISOString();
  const ate = new Date(startOfDayInstantInTz(`${somarMeses(mesAte, 1)}-01`)).toISOString();
  const admin = createAdminClient();
  const linhas: ReuniaoDoCliente[] = [];

  for (let desde = 0; ; desde += PAGINA) {
    let q = admin
      .from("reunioes")
      .select("id, tipo, status, data_hora_inicio, cliente:pessoas(nome, grupo_cliente)")
      .neq("status", "CANCELADA")
      .not("cliente_id", "is", null)
      .gte("data_hora_inicio", de)
      .lt("data_hora_inicio", ate)
      .order("id")
      .range(desde, desde + PAGINA - 1);
    if (opts.tipo) q = q.eq("tipo", opts.tipo);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    type Linha = {
      tipo: string;
      status: string;
      data_hora_inicio: string;
      cliente: { nome: string | null; grupo_cliente: string | null } | null;
    };
    for (const r of (data ?? []) as unknown as Linha[]) {
      const cliente = (r.cliente?.grupo_cliente ?? "").trim() || (r.cliente?.nome ?? "").trim();
      if (!cliente) continue;
      linhas.push({
        cliente,
        mes: mesKeyInTz(r.data_hora_inicio),
        inicio: r.data_hora_inicio,
        status: r.status,
        tipo: r.tipo,
      });
    }
    if ((data?.length ?? 0) < PAGINA) break;
  }
  return linhas;
}
