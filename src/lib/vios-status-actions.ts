"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { ehCompromissoDeReuniao } from "@/lib/vios-agendamento";
import { pedirProrrogacaoVios } from "@/lib/vios-prorrogacao";

type OpcaoVios = { id: string; nome: string };

export type ResultadoOpcoesVios =
  | {
      ok: true;
      fonte: "pasta" | "catalogo";
      area: string | null;
      ci_pasta: string | null;
      titulo: string | null;
      etapas: OpcaoVios[];
      etiquetas: OpcaoVios[];
      usuarios: OpcaoVios[];
    }
  | { ok: false; precisaVios: true; area: string | null }
  | { ok: false; precisaVios?: false; erro: string };

const semAcento = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const CACHE_PASTA_MS = 24 * 3600_000;

/**
 * Descobre as opções do VIOS para uma pasta SEM abrir o VIOS:
 * 1) cache da própria pasta; 2) área da pasta (dados já sincronizados) → catálogo
 * por (tipo, área). Se não souber, devolve precisaVios e o navegador consulta o
 * robô (Edge Function vios-opcoes), que também alimenta o catálogo.
 */
export async function resolverOpcoesVios(
  pastaTipo: "Processo" | "Atendimento",
  numero: string
): Promise<ResultadoOpcoesVios> {
  const pessoa = await getPessoaAtual();
  if (!pessoa) return { ok: false, erro: "Não autenticado." };
  const n = String(numero ?? "").trim();
  if (!n) return { ok: false, erro: "Informe o número." };

  const admin = createAdminClient();

  // 1) cache da própria pasta
  const { data: cache } = await admin
    .from("vios_pasta_opcoes")
    .select("ci_pasta, titulo, etapas, etiquetas, usuarios, atualizado_em")
    .eq("pasta_tipo", pastaTipo)
    .eq("pasta", n)
    .maybeSingle();
  if (cache && Date.now() - new Date(cache.atualizado_em).getTime() < CACHE_PASTA_MS) {
    return {
      ok: true,
      fonte: "pasta",
      area: null,
      ci_pasta: cache.ci_pasta,
      titulo: cache.titulo,
      etapas: cache.etapas ?? [],
      etiquetas: cache.etiquetas ?? [],
      usuarios: cache.usuarios ?? [],
    };
  }

  // 2) área da pasta, pelos dados que o SAMA já tem
  let area: string | null = null;
  let ci: string | null = null;
  if (pastaTipo === "Processo") {
    const { data: vp } = await admin
      .from("vios_pastas")
      .select("ci, area")
      .eq("cnj", n)
      .limit(1)
      .maybeSingle();
    if (vp?.area) ({ area, ci } = vp);
    if (!area) {
      const { data: pc } = await admin
        .from("processos_completo")
        .select("ci, area")
        .eq("nro_cnj", n)
        .limit(1)
        .maybeSingle();
      if (pc?.area) ({ area, ci } = pc);
    }
    if (!area) {
      const { data: vt } = await admin
        .from("vios_tarefas")
        .select("ci_do_processo, area_do_processo")
        .eq("nro_cnj", n)
        .not("area_do_processo", "is", null)
        .limit(1)
        .maybeSingle();
      if (vt?.area_do_processo) {
        area = vt.area_do_processo;
        ci = vt.ci_do_processo;
      }
    }
  } else {
    const { data: vp } = await admin
      .from("vios_pastas")
      .select("ci, area, pasta_tipo")
      .eq("ci", n)
      .maybeSingle();
    if (vp?.area && vp.pasta_tipo === "Atendimento") ({ area, ci } = vp);
    if (!area) {
      const { data: vt } = await admin
        .from("vios_tarefas")
        .select("ci_do_processo, area_do_processo")
        .eq("ci_do_processo", n)
        .not("area_do_processo", "is", null)
        .limit(1)
        .maybeSingle();
      if (vt?.area_do_processo) {
        area = vt.area_do_processo;
        ci = vt.ci_do_processo;
      }
    }
  }
  if (!area) return { ok: false, precisaVios: true, area: null };

  // 3) catálogo (tipo, área)
  const { data: cat } = await admin
    .from("vios_catalogo_tarefas")
    .select("area, etapas, etiquetas, usuarios")
    .eq("pasta_tipo", pastaTipo);
  const grupo = (cat ?? []).find((c) => semAcento(c.area) === semAcento(area));
  if (!grupo) return { ok: false, precisaVios: true, area };

  return {
    ok: true,
    fonte: "catalogo",
    area: grupo.area,
    ci_pasta: ci,
    titulo: `${pastaTipo === "Processo" ? "Processo" : "Atendimento"} · ${grupo.area}`,
    etapas: grupo.etapas ?? [],
    etiquetas: grupo.etiquetas ?? [],
    usuarios: grupo.usuarios ?? [],
  };
}

/**
 * Responsáveis e etiquetas do VIOS (as mesmas em qualquer pasta), do catálogo salvo pelo
 * robô. Não consulta pasta nem processo nenhum.
 */
export async function listarUsuariosVios(): Promise<
  { ok: true; usuarios: OpcaoVios[]; etiquetas: OpcaoVios[] } | { ok: false; erro: string }
> {
  const pessoa = await getPessoaAtual();
  if (!pessoa) return { ok: false, erro: "Não autenticado." };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vios_catalogo_tarefas")
    .select("usuarios, etiquetas, atualizado_em")
    .order("atualizado_em", { ascending: false });
  if (error) return { ok: false, erro: error.message };
  const usuarios = new Map<string, OpcaoVios>();
  const etiquetas = new Map<string, OpcaoVios>();
  for (const r of data ?? []) {
    for (const u of (r.usuarios ?? []) as OpcaoVios[]) {
      // o usuário do robô não é responsável de tarefa
      if (u?.id && !usuarios.has(u.id) && !/f[eê]nix agendador/i.test(u.nome)) usuarios.set(u.id, u);
    }
    for (const e of (r.etiquetas ?? []) as OpcaoVios[]) {
      if (e?.id && !etiquetas.has(e.id)) etiquetas.set(e.id, e);
    }
  }
  return {
    ok: true,
    usuarios: [...usuarios.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    etiquetas: [...etiquetas.values()],
  };
}

export type AgendamentoViosStatus = {
  id: string;
  observacao: string;
  passo_texto: string | null;
  status: "pendente" | "enviado" | "processando" | "concluido" | "erro";
  erro: string | null;
  tarefa: string;
  responsavel: string | null;
  data: string;
  pasta: string;
  ci_vios: string | null;
  /** Status atual da tarefa no VIOS (`vios_tarefas.vios_status`). */
  status_tarefa: string | null;
  ci_pasta: string | null;
  avisos: string[];
  criado_em: string;
  atualizado_em: string;
  /** Data com que a tarefa foi criada (`data` já traz a última data pedida no SAMA). */
  data_original: string;
  /** Última mudança de data pedida ao VIOS depois da criação. */
  prorrogacao: {
    status: AgendamentoViosStatus["status"];
    data: string;
    erro: string | null;
  } | null;
};

type AgendamentoViosRow = {
  id: string;
  reuniao_id: string | null;
  operacao: string;
  origem_id: string | null;
  observacao: string;
  passo_texto: string | null;
  status: AgendamentoViosStatus["status"];
  erro: string | null;
  tarefa: string;
  responsavel: string | null;
  data: string;
  pasta: string;
  resultado: {
    ci_vios?: string | number | null;
    ci_pasta?: string | null;
    avisos?: string[];
    vios_status?: string | null;
  } | null;
  criado_em: string;
  atualizado_em: string;
};

async function comStatusTarefa(
  linhas: (Omit<AgendamentoViosStatus, "status_tarefa"> & { status_gravado?: string | null })[]
): Promise<AgendamentoViosStatus[]> {
  const admin = createAdminClient();
  const cis = [...new Set(linhas.map((l) => l.ci_vios).filter((ci): ci is string => Boolean(ci)))];
  const statusPorCi = new Map<string, string | null>();
  if (cis.length > 0) {
    const { data: tarefas } = await admin
      .from("vios_tarefas")
      .select("ci, vios_status")
      .in("ci", cis);
    for (const t of tarefas ?? []) {
      if (t.ci) statusPorCi.set(t.ci, t.vios_status ?? null);
    }
  }
  return linhas.map(({ status_gravado, ...l }) => ({
    ...l,
    status_tarefa: l.ci_vios
      ? (statusPorCi.get(l.ci_vios) ||
          status_gravado ||
          // Tarefa recém-criada ainda não entrou no espelho do VIOS: ela nasce Pendente.
          (l.status === "concluido" ? "Pendente" : null))
      : null,
  }));
}

function linhaAgendamento(
  r: AgendamentoViosRow,
  prorrogacoes: AgendamentoViosRow[]
): Omit<AgendamentoViosStatus, "status_tarefa"> & { status_gravado: string | null } {
  const res = r.resultado ?? {};
  // Mais recente primeiro (a lista vem por criado_em desc).
  const ultima = prorrogacoes[0] ?? null;
  const vigente = prorrogacoes.find((p) => p.status !== "erro") ?? null;
  return {
    id: r.id,
    observacao: r.observacao,
    passo_texto: r.passo_texto ?? null,
    status: r.status,
    erro: r.erro,
    tarefa: r.tarefa,
    responsavel: r.responsavel,
    data: vigente?.data ?? r.data,
    data_original: r.data,
    prorrogacao: ultima
      ? { status: ultima.status, data: ultima.data, erro: ultima.erro }
      : null,
    pasta: r.pasta,
    ci_vios: res.ci_vios != null ? String(res.ci_vios) : null,
    status_gravado: res.vios_status?.trim() || null,
    ci_pasta: res.ci_pasta ?? null,
    avisos: Array.isArray(res.avisos) ? res.avisos : [],
    criado_em: r.criado_em,
    atualizado_em: r.atualizado_em,
  };
}

/** Situação na fila do VIOS de cada próximo passo enviado desta reunião. */
export async function listarAgendamentosVios(
  reuniaoId: string
): Promise<AgendamentoViosStatus[]> {
  const mapa = await listarAgendamentosViosPorReunioes([reuniaoId]);
  return mapa[reuniaoId] ?? [];
}

/** Agendamentos VIOS das reuniões que o usuário já pode ver. Mais recente primeiro. */
export async function listarAgendamentosViosPorReunioes(
  reuniaoIds: string[]
): Promise<Record<string, AgendamentoViosStatus[]>> {
  const pessoa = await getPessoaAtual();
  const ids = [...new Set(reuniaoIds.filter(Boolean))];
  if (!pessoa || ids.length === 0) return {};

  const supabase = await createClient();
  const visiveis: string[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("reunioes")
      .select("id")
      .in("id", ids.slice(i, i + 150));
    for (const row of data ?? []) visiveis.push(row.id);
  }
  if (visiveis.length === 0) return {};

  const admin = createAdminClient();
  const bruto: AgendamentoViosRow[] = [];
  for (let i = 0; i < visiveis.length; i += 150) {
    const fatia = visiveis.slice(i, i + 150);
    const { data } = await admin
      .from("vios_agendamentos")
      .select(
        "id, reuniao_id, operacao, origem_id, observacao, passo_texto, status, erro, tarefa, responsavel, data, pasta, resultado, criado_em, atualizado_em"
      )
      .in("reuniao_id", fatia)
      .order("criado_em", { ascending: false });
    bruto.push(...((data ?? []) as AgendamentoViosRow[]));
  }

  // Prorrogações não são tarefas novas: entram como data atual da criação.
  const prorrogacoesPorOrigem = new Map<string, AgendamentoViosRow[]>();
  for (const row of bruto) {
    if (row.operacao !== "prorrogar" || !row.origem_id) continue;
    const lista = prorrogacoesPorOrigem.get(row.origem_id) ?? [];
    lista.push(row);
    prorrogacoesPorOrigem.set(row.origem_id, lista);
  }
  const criacoes = bruto.filter((row) => row.operacao !== "prorrogar");

  const completos = await comStatusTarefa(
    criacoes.map((row) => linhaAgendamento(row, prorrogacoesPorOrigem.get(row.id) ?? []))
  );
  const mapa: Record<string, AgendamentoViosStatus[]> = {};
  criacoes.forEach((row, index) => {
    const reuniaoId = row.reuniao_id;
    if (!reuniaoId) return;
    (mapa[reuniaoId] ??= []).push(completos[index]);
  });
  return mapa;
}

/**
 * Muda no SAMA a data de um próximo passo já enviado ao VIOS. A mudança vai
 * sozinha para a fila: o robô prorroga a tarefa que já existe no VIOS.
 * O compromisso da reunião segue a data da reunião, não muda por aqui.
 */
export async function alterarDataAgendamentoVios(
  agendamentoId: string,
  novaData: string
): Promise<{ ok: boolean; error?: string; acao?: string }> {
  const pessoa = await getPessoaAtual();
  if (!pessoa) return { ok: false, error: "Não autenticado." };
  const data = novaData.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return { ok: false, error: "Informe a data em DD/MM/AAAA." };

  const admin = createAdminClient();
  const { data: linha } = await admin
    .from("vios_agendamentos")
    .select("id, operacao, reuniao_id, criado_por_id, tarefa")
    .eq("id", agendamentoId)
    .maybeSingle();
  if (!linha || linha.operacao !== "criar") return { ok: false, error: "Agendamento não encontrado." };
  if (ehCompromissoDeReuniao(linha.tarefa)) {
    return { ok: false, error: "O compromisso segue a data da reunião: mude a data da reunião." };
  }

  if (!pessoa.is_admin && linha.criado_por_id !== pessoa.id) {
    const supabase = await createClient();
    const { data: reuniao } = linha.reuniao_id
      ? await supabase.from("reunioes").select("criado_por_id").eq("id", linha.reuniao_id).maybeSingle()
      : { data: null };
    if (!reuniao || reuniao.criado_por_id !== pessoa.id) {
      return { ok: false, error: "Sem permissão para mudar a data deste agendamento." };
    }
  }

  const r = await pedirProrrogacaoVios(linha.id, data, pessoa.id);
  return r.ok ? { ok: true, acao: r.acao } : { ok: false, error: r.error };
}
