import "server-only";

import {
  normalizeNomeLista,
  tarefaEnvolveUsuario,
} from "@/lib/vios-tarefas-utils";

export { normalizeNomeLista, tarefaEnvolveUsuario };

const VIOS_BASE = "https://bp.vios.com.br";

export type ViosTarefa = {
  ci: number;
  ci_do_processo?: number | null;
  data_para_conclusao?: string | null;
  data_limite?: string | null;
  data_acao?: string | null;
  horario?: string | null;
  nro_cnj?: string | null;
  area_do_processo?: string | null;
  objeto_do_processo?: string | null;
  pasta?: string | null;
  pasta_cliente?: string | null;
  tarefa_pai?: number | null;
  tarefa?: string | null;
  descricao?: string | null;
  obs_proc?: string | null;
  cliente?: string | null;
  grupo_cliente?: string | null;
  partes_ativas?: { nome?: string }[] | string[];
  partes_passivas?: { nome?: string }[] | string[];
  comentarios?: string[];
  historico?: string[];
  responsaveis?: string[] | Record<string, string>;
  auxiliares?: string[] | Record<string, string>;
};

export class ViosApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ViosApiError";
    this.status = status;
  }
}

function normalizeTarefa(raw: ViosTarefa): ViosTarefa {
  return {
    ...raw,
    responsaveis: normalizeNomeLista(raw.responsaveis),
    auxiliares: normalizeNomeLista(raw.auxiliares),
    comentarios: normalizeNomeLista(raw.comentarios),
    historico: normalizeNomeLista(raw.historico),
  };
}

export function viosConfigurado(): boolean {
  return Boolean(process.env.VIOS_TOKEN?.trim());
}

function authHeaders(): HeadersInit {
  const raw = process.env.VIOS_TOKEN!.trim();
  const bearer = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
  return {
    accept: "application/json",
    "Authorization-Vios": bearer,
  };
}

async function viosGet<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(path, VIOS_BASE);
  if (params) url.search = new URLSearchParams(params).toString();

  const res = await fetch(url.toString(), {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    let msg = txt.slice(0, 300);
    try {
      const j = JSON.parse(txt) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* corpo não-JSON */
    }
    throw new ViosApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}

export type ViosTarefasFiltro = {
  data_para_conclusao_inicial?: string;
  data_para_conclusao_final?: string;
  data_limite_inicial?: string;
  data_limite_final?: string;
};

/** Consulta tarefas processuais na API VIOS (integração BP). */
export async function fetchViosTarefas(
  filtro: ViosTarefasFiltro = {}
): Promise<ViosTarefa[]> {
  if (!viosConfigurado()) {
    throw new Error("VIOS_TOKEN não configurado no ambiente.");
  }

  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtro)) {
    if (v) params[k] = v;
  }

  const data = await viosGet<ViosTarefa[]>(
    "/api/integracoes/bp/tarefas",
    params
  );
  return (Array.isArray(data) ? data : []).map(normalizeTarefa);
}

/** yyyy-MM-dd */
export function formatDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Janela padrão: 30 dias atrás até 90 dias à frente (por data limite). */
export function defaultTarefasRange(): ViosTarefasFiltro {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 30);
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 90);
  const de = formatDateParam(inicio);
  const ate = formatDateParam(fim);
  return {
    data_limite_inicial: de,
    data_limite_final: ate,
    data_para_conclusao_inicial: de,
    data_para_conclusao_final: ate,
  };
}
