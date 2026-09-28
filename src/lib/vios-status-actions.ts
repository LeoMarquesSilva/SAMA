"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";

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
};

/** Situação na fila do VIOS de cada próximo passo enviado desta reunião. */
export async function listarAgendamentosVios(
  reuniaoId: string
): Promise<AgendamentoViosStatus[]> {
  const pessoa = await getPessoaAtual();
  if (!pessoa || !reuniaoId) return [];

  // só mostra se o usuário pode ver a reunião (RLS da reunião)
  const supabase = await createClient();
  const { data: reuniao } = await supabase
    .from("reunioes")
    .select("id")
    .eq("id", reuniaoId)
    .maybeSingle();
  if (!reuniao) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("vios_agendamentos")
    .select("id, observacao, passo_texto, status, erro, tarefa, responsavel, data, pasta, resultado, criado_em, atualizado_em")
    .eq("reuniao_id", reuniaoId)
    .order("criado_em", { ascending: false });

  const linhas = (data ?? []).map((r) => {
    const res = (r.resultado ?? {}) as { ci_vios?: string | number | null; ci_pasta?: string | null; avisos?: string[] };
    return {
      id: r.id,
      observacao: r.observacao,
      passo_texto: r.passo_texto ?? null,
      status: r.status,
      erro: r.erro,
      tarefa: r.tarefa,
      responsavel: r.responsavel,
      data: r.data,
      pasta: r.pasta,
      ci_vios: res.ci_vios != null ? String(res.ci_vios) : null,
      ci_pasta: res.ci_pasta ?? null,
      avisos: Array.isArray(res.avisos) ? res.avisos : [],
      criado_em: r.criado_em,
      atualizado_em: r.atualizado_em,
    };
  });

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

  return linhas.map((l) => ({
    ...l,
    status_tarefa: l.ci_vios ? (statusPorCi.get(l.ci_vios) ?? null) : null,
  }));
}
