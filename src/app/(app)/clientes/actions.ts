"use server";

import { isGrupoSemNome, labelGrupoCliente } from "@/lib/clientes";
import { GRUPO_CLIENTE_GESTAO_EQUIPE } from "@/lib/constants";
import {
  candidatosTituloReuniao,
  pontuarClienteNoTitulo,
  PONTUACAO_MINIMA_SUGESTAO,
} from "@/lib/clientes-titulo";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { isEmailEscritorio } from "@/lib/email-escritorio";
import { createClient } from "@/lib/supabase/server";
import type { EmpresaDoGrupo } from "@/types/database";

export type ClienteBusca = {
  ci: string;
  nome: string;
  cpf_cnpj: string | null;
  grupo_cliente: string | null;
  /** Linha agregada do grupo (ex.: busca "CDA" → Grupo CDA). */
  kind?: "grupo" | "empresa";
  total_empresas?: number;
};

async function ciRepresentanteDoGrupo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoCliente: string,
  query: string
): Promise<string | null> {
  const safe = query.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;

  // `pessoas` tem índice em grupo_cliente; a view recalcula processos e timesheets
  // a cada consulta, então só é usada para grupos herdados dos processos.
  async function representante(tabela: "pessoas" | "escritorio_empresas_por_grupo") {
    const base = () => {
      const q = supabase.from(tabela).select("ci, nome").order("nome");
      return isGrupoSemNome(grupoCliente)
        ? q.is("grupo_cliente", null)
        : q.eq("grupo_cliente", grupoCliente);
    };
    const [{ data: match }, { data: first }] = await Promise.all([
      base().or(`nome.ilike.${like}`).limit(1),
      base().limit(1),
    ]);
    return match?.[0]?.ci ?? first?.[0]?.ci ?? null;
  }

  return (
    (await representante("pessoas")) ??
    (await representante("escritorio_empresas_por_grupo"))
  );
}

/** Monta entrada de busca/seleção sempre como grupo (nunca empresa avulsa). */
async function montarEntradaGrupo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupoCliente: string,
  query: string,
  totalEmpresas?: number | null
): Promise<ClienteBusca | null> {
  const chave = grupoCliente ?? "";
  if (isGrupoSemNome(chave)) return null;

  const [ci, total] = await Promise.all([
    ciRepresentanteDoGrupo(supabase, chave, query),
    totalEmpresas != null
      ? Promise.resolve(totalEmpresas)
      : supabase
          .from("escritorio_grupos_resumo")
          .select("total_empresas")
          .eq("grupo_cliente", chave)
          .maybeSingle()
          .then(({ data }) => data?.total_empresas ?? null),
  ]);
  if (!ci) return null;

  return {
    ci,
    nome: labelGrupoCliente(chave),
    cpf_cnpj: null,
    grupo_cliente: chave,
    kind: "grupo",
    total_empresas: total ?? undefined,
  };
}

async function montarEntradasGrupos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grupos: { grupo_cliente: string | null; total_empresas: number | null }[],
  query: string
): Promise<ClienteBusca[]> {
  const entradas = await Promise.all(
    grupos.map((g) =>
      montarEntradaGrupo(supabase, g.grupo_cliente ?? "", query, g.total_empresas)
    )
  );
  return entradas.filter((e): e is ClienteBusca => e !== null);
}

async function buscarGruposParaSugestao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string
): Promise<ClienteBusca[]> {
  const safe = query.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;

  const { data: gruposRaw } = await supabase
    .from("escritorio_grupos_resumo")
    .select("grupo_cliente, total_empresas")
    .ilike("grupo_cliente", like)
    .order("grupo_cliente")
    .limit(10);

  return montarEntradasGrupos(supabase, gruposRaw ?? [], query);
}

/** Se o match cair em empresa, sobe para o grupo_cliente dela. */
async function buscarGrupoPorEmpresa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string
): Promise<ClienteBusca | null> {
  const safe = query.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;

  const { data } = await supabase
    .from("pessoas")
    .select("grupo_cliente")
    .or(`nome.ilike.${like},grupo_cliente.ilike.${like}`)
    .not("grupo_cliente", "is", null)
    .neq("grupo_cliente", "")
    .limit(1);

  const grupo = data?.[0]?.grupo_cliente?.trim();
  if (!grupo) return null;
  return montarEntradaGrupo(supabase, grupo, query);
}

/**
 * Empresas de um grupo (view escritorio_empresas_por_grupo), paginado.
 */
export async function listarEmpresasDoGrupo(
  grupoCliente: string,
  opts?: { q?: string; pagina?: number; porPagina?: number }
): Promise<{ empresas: EmpresaDoGrupo[]; total: number }> {
  const porPagina = opts?.porPagina ?? 50;
  const pagina = Math.max(1, opts?.pagina ?? 1);
  const q = (opts?.q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { empresas: [], total: 0 };

  let query = supabase
    .from("escritorio_empresas_por_grupo")
    .select("ci, nome, cpf_cnpj, categoria, qtd_processos", { count: "exact" })
    .order("nome")
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  // Resumo usa '' para "Sem grupo"; a view de empresas retorna null (espelho SIOE).
  query = isGrupoSemNome(grupoCliente)
    ? query.is("grupo_cliente", null)
    : query.eq("grupo_cliente", grupoCliente);

  if (q.length >= 2) {
    const safe = q.replace(/[,()]/g, " ").trim();
    const like = `%${safe}%`;
    query = query.or(`nome.ilike.${like},cpf_cnpj.ilike.${like}`);
  }

  const { data, count } = await query;
  return {
    empresas: (data as EmpresaDoGrupo[]) ?? [],
    total: count ?? 0,
  };
}

/** Retorna o CI quando o grupo tem exatamente uma empresa. */
export async function obterCiEmpresaUnicaDoGrupo(
  grupoCliente: string
): Promise<string | null> {
  const { empresas, total } = await listarEmpresasDoGrupo(grupoCliente, {
    porPagina: 1,
  });
  if (total !== 1 || !empresas[0]?.ci) return null;
  return empresas[0].ci;
}

/**
 * Busca clientes (espelho do VIOS) por nome, CNPJ ou grupo — para o seletor
 * de cliente da reunião. A tabela tem ~37k linhas, então a busca é sempre
 * server-side e limitada.
 */
export async function buscarClientes(q: string): Promise<ClienteBusca[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const safe = query.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;

  const [{ data: gruposRaw }, { data: pessoasRaw }] = await Promise.all([
    supabase
      .from("escritorio_grupos_resumo")
      .select("grupo_cliente, total_empresas")
      .ilike("grupo_cliente", like)
      .order("grupo_cliente")
      .limit(5),
    supabase
      .from("pessoas")
      .select("ci, nome, cpf_cnpj, grupo_cliente")
      .or(
        `nome.ilike.${like},cpf_cnpj.ilike.${like},grupo_cliente.ilike.${like}`
      )
      .order("nome")
      .limit(20),
  ]);

  const grupos = await montarEntradasGrupos(supabase, gruposRaw ?? [], query);

  const pessoas: ClienteBusca[] = (pessoasRaw ?? []).map((p) => ({
    ...(p as ClienteBusca),
    kind: "empresa" as const,
  }));

  const pessoasFiltradas =
    grupos.length === 1 && (grupos[0].total_empresas ?? 0) <= 1
      ? pessoas.filter((p) => (p.grupo_cliente ?? "") !== grupos[0].grupo_cliente)
      : pessoas;

  return [...grupos, ...pessoasFiltradas].slice(0, 25);
}

/**
 * Resolve cliente VIOS por nome (e grupo, quando informado) — ex.: prefill do modal
 * de reclassificação a partir de tarefa importada.
 */
export async function resolverClienteVios(
  nome: string | null | undefined,
  grupoCliente?: string | null
): Promise<ClienteBusca | null> {
  const n = (nome ?? "").trim();
  if (n.length < 2) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const select = "ci, nome, cpf_cnpj, grupo_cliente";
  const grupo = (grupoCliente ?? "").trim();

  if (grupo) {
    const { data: porGrupo } = await supabase
      .from("pessoas")
      .select(select)
      .ilike("nome", n)
      .eq("grupo_cliente", grupo)
      .limit(1);
    if (porGrupo?.[0]) {
      return (
        (await montarEntradaGrupo(supabase, grupo, n)) ??
        ({ ...porGrupo[0], kind: "empresa" } as ClienteBusca)
      );
    }
  }

  const { data: exato } = await supabase
    .from("pessoas")
    .select(select)
    .ilike("nome", n)
    .limit(1);
  if (exato?.[0]) {
    const g = exato[0].grupo_cliente?.trim();
    if (g) {
      return (await montarEntradaGrupo(supabase, g, n)) ?? null;
    }
    return { ...exato[0], kind: "empresa" } as ClienteBusca;
  }

  const safe = n.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;
  const { data } = await supabase
    .from("pessoas")
    .select(select)
    .or(`nome.ilike.${like},grupo_cliente.ilike.${like}`)
    .order("nome")
    .limit(1);

  const hit = data?.[0];
  if (!hit) return null;
  const g = hit.grupo_cliente?.trim();
  if (g) return (await montarEntradaGrupo(supabase, g, n)) ?? null;
  return { ...hit, kind: "empresa" } as ClienteBusca;
}

/**
 * Sugere cliente/grupo a partir do título da reunião (ex.: "Movent - Follow-up"
 * → grupo Movent). Prioriza match em grupo_cliente do VIOS.
 */
export async function sugerirClientePorTituloReuniao(
  titulo: string | null | undefined
): Promise<ClienteBusca | null> {
  const candidatos = candidatosTituloReuniao((titulo ?? "").trim());
  if (!candidatos.length) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let melhor: { cliente: ClienteBusca; score: number } | null = null;

  const gruposPorCandidato = await Promise.all(
    candidatos.map((cand) => buscarGruposParaSugestao(supabase, cand))
  );

  for (const [i, cand] of candidatos.entries()) {
    const grupos = gruposPorCandidato[i];
    for (const g of grupos) {
      const score = pontuarClienteNoTitulo(cand, g);
      if (!melhor || score > melhor.score) melhor = { cliente: g, score };
    }

    if (!melhor || melhor.score < PONTUACAO_MINIMA_SUGESTAO) {
      const viaEmpresa = await buscarGrupoPorEmpresa(supabase, cand);
      if (viaEmpresa) {
        const score = pontuarClienteNoTitulo(cand, viaEmpresa);
        if (!melhor || score > melhor.score) melhor = { cliente: viaEmpresa, score };
      }
    }

    if (melhor && melhor.score >= 95) break;
  }

  if (!melhor || melhor.score < PONTUACAO_MINIMA_SUGESTAO) return null;
  return melhor.cliente;
}

/** Cria contato de captação local (não existe no VIOS). */
export async function criarLeadCaptacao(
  nome: string
): Promise<{ ok: boolean; error?: string; cliente?: ClienteBusca }> {
  const trimmed = nome.trim();
  if (trimmed.length < 2) {
    return {
      ok: false,
      error: "Informe ao menos 2 caracteres para o nome do contato.",
    };
  }

  const pessoa = await getPessoaAtual();
  if (!pessoa) {
    return { ok: false, error: "Não foi possível identificar quem está logado." };
  }

  const supabase = await createClient();
  const ci = `SAMA-LEAD-${crypto.randomUUID()}`;
  const nomeMaiusculo = trimmed.toLocaleUpperCase("pt-BR");

  const { data, error } = await supabase
    .from("pessoas")
    .insert({
      ci,
      nome: nomeMaiusculo,
      categoria: "CAPTAÇÃO",
      etiquetas: "captacao_sama",
      criado_por_usuario_id: pessoa.id,
      data_cadastro: new Date().toISOString().slice(0, 10),
    })
    .select("ci, nome, cpf_cnpj, grupo_cliente")
    .single();

  if (error) {
    return { ok: false, error: "Não foi possível criar o contato de captação." };
  }

  return { ok: true, cliente: data as ClienteBusca };
}

/** Grupo padrão para reuniões internas do escritório (Gestão de Equipe / Operacional). */
export async function resolverGrupoGestaoEquipe(): Promise<ClienteBusca | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return montarEntradaGrupo(
    supabase,
    GRUPO_CLIENTE_GESTAO_EQUIPE,
    GRUPO_CLIENTE_GESTAO_EQUIPE
  );
}

function guardarEmailExterno(destino: Map<string, string>, bruto: string | null | undefined) {
  const email = (bruto ?? "").trim();
  if (!email || !email.includes("@") || isEmailEscritorio(email)) return;
  const chave = email.toLowerCase();
  if (!destino.has(chave)) destino.set(chave, email);
}

/** E-mails de quem já participou de reunião desse grupo, sem endereços do escritório. */
export async function listarEmailsExternosDoGrupo(
  grupoCliente: string
): Promise<string[]> {
  const grupo = grupoCliente.trim();
  if (!grupo) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const cis: string[] = [];
  const pagina = 1000;
  for (let from = 0; ; from += pagina) {
    const { data } = await supabase
      .from("pessoas")
      .select("ci")
      .eq("grupo_cliente", grupo)
      .range(from, from + pagina - 1);
    const rows = data ?? [];
    for (const row of rows) {
      if (row.ci) cis.push(row.ci);
    }
    if (rows.length < pagina) break;
  }
  if (cis.length === 0) return [];

  const emails = new Map<string, string>();
  const reuniaoIds: string[] = [];
  for (let i = 0; i < cis.length; i += 150) {
    const { data } = await supabase
      .from("reunioes")
      .select("id, emails_cliente")
      .in("cliente_id", cis.slice(i, i + 150));
    for (const reuniao of data ?? []) {
      reuniaoIds.push(reuniao.id);
      for (const email of reuniao.emails_cliente ?? []) {
        guardarEmailExterno(emails, email);
      }
    }
  }

  for (let i = 0; i < reuniaoIds.length; i += 150) {
    const { data } = await supabase
      .from("reuniao_participantes")
      .select("email")
      .in("reuniao_id", reuniaoIds.slice(i, i + 150))
      .is("colaborador_id", null);
    for (const participante of data ?? []) {
      guardarEmailExterno(emails, participante.email);
    }
  }

  return [...emails.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
