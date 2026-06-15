/**
 * Classifica tarefas VIOS mapeadas por tarefa pai (match exato).
 * Uso: node scripts/classificar-tarefas-automaticas.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TIPO_POR_NOME = {
  "2. REVISAR": "REVISAO_PRAZO",
  "AUDIÊNCIA UNA/INICIAL": "AUDIENCIA",
  "SESSÃO DE JULGAMENTO": "AUDIENCIA",
  "DESPACHO/MEDIAÇÃO - ONLINE": "DESPACHO",
  "PROPOSTA/CONTRATO DE HONORÁRIOS": "LEVANTAMENTO_DUE_PROPOSTA_CONTRATO",
  "AUD. CONCILIAÇÃO": "AUDIENCIA",
  "ENVIAR DUE DILLIGENCE PROSPECT": "LEVANTAMENTO_DUE_PROPOSTA_CONTRATO",
  "PROTOCOLO DUE DILLIGENCE PROSPECT": "LEVANTAMENTO_DUE_PROPOSTA_CONTRATO",
};

function normalizeNomeCompare(value) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

const TIPO_POR_NOME_NORM = Object.fromEntries(
  Object.entries(TIPO_POR_NOME).map(([nome, tipo]) => [
    normalizeNomeCompare(nome),
    tipo,
  ])
);

function tipoAtividadePorTarefaPai(t) {
  for (const raw of [t.tarefa_pai, t.tarefa]) {
    const norm = normalizeNomeCompare(raw);
    if (norm && TIPO_POR_NOME_NORM[norm]) return TIPO_POR_NOME_NORM[norm];
  }
  return null;
}

function parseHorario(horario) {
  if (!horario) return "09:00";
  const m = String(horario).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "09:00";
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
}

function tarefaDataHoraConclusao(t) {
  const date = t.data_conclusao || t.data_limite || t.data_para_conclusao;
  if (!date) return "";
  const time = t.hora_conclusao
    ? parseHorario(t.hora_conclusao)
    : parseHorario(t.horario);
  return `${date}T${time}`;
}

function limparTituloRevisar(value) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+\.\s*revisar$/.test(normalizeNomeCompare(trimmed))) {
    return trimmed.replace(/^\d+\.\s*/i, "");
  }
  return trimmed;
}

function tituloCompleto(t) {
  const tarefa = limparTituloRevisar(t.tarefa);
  const paiRaw = limparTituloRevisar(t.tarefa_pai);
  const pai =
    tarefa && paiRaw && normalizeNomeCompare(tarefa) === normalizeNomeCompare(paiRaw)
      ? null
      : paiRaw;
  if (tarefa && pai) return `${tarefa} · ${pai}`;
  return tarefa || pai || "Sem título";
}

function buildDescricao(t) {
  const parts = [];
  if (t.descricao?.trim()) parts.push(t.descricao.trim());
  const meta = [];
  if (t.nro_cnj) meta.push(`Processo: ${t.nro_cnj}`);
  if (t.pasta) meta.push(`Pasta: ${t.pasta}`);
  if (t.ci) meta.push(`CI tarefa VIOS: ${t.ci}`);
  if (meta.length) parts.push(meta.join("\n"));
  return parts.join("\n\n") || null;
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: tarefas, error } = await supabase
  .from("vios_tarefas")
  .select("*")
  .eq("status", "PENDENTE")
  .is("atividade_id", null);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const alvo = (tarefas ?? []).filter(
  (t) => tipoAtividadePorTarefaPai(t) && t.usuario_concluiu_id
);

const porTipo = {};
for (const t of alvo) {
  const tipo = tipoAtividadePorTarefaPai(t);
  porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
}

console.log(`Pendentes de classificar: ${alvo.length}`);
for (const [tipo, qtd] of Object.entries(porTipo)) {
  console.log(`  ${tipo}: ${qtd}`);
}

const classificadas = {};
let erros = 0;
const agora = new Date().toISOString();

for (const t of alvo) {
  const tipo = tipoAtividadePorTarefaPai(t);
  if (!tipo) continue;

  const inicioLocal = tarefaDataHoraConclusao(t);
  const inicio = inicioLocal
    ? new Date(inicioLocal).toISOString()
    : new Date().toISOString();

  const { data: atv, error: insErr } = await supabase
    .from("atividades_internas")
    .insert({
      titulo: tituloCompleto(t),
      tipo,
      status: "REALIZADA",
      data_hora_inicio: inicio,
      data_hora_fim: null,
      duracao_minutos: null,
      pessoa_id: t.usuario_concluiu_id,
      descricao: buildDescricao(t),
      tema: t.cliente ?? null,
      com_pessoa_nome: null,
      com_pessoa_id: null,
      motivo_cancelamento: null,
    })
    .select("id")
    .single();

  if (insErr || !atv) {
    console.error("Erro ao criar atividade", t.ci, insErr?.message);
    erros++;
    continue;
  }

  const { error: updErr } = await supabase
    .from("vios_tarefas")
    .update({
      status: "CATEGORIZADO_ATIVIDADE",
      atividade_id: atv.id,
      categorizado_em: agora,
    })
    .eq("id", t.id);

  if (updErr) {
    console.error("Erro ao vincular tarefa", t.ci, updErr.message);
    erros++;
    continue;
  }

  classificadas[tipo] = (classificadas[tipo] ?? 0) + 1;
}

const total = Object.values(classificadas).reduce((s, n) => s + n, 0);
console.log(`Concluído: ${total} atividade(s). Erros: ${erros}`);
for (const [tipo, qtd] of Object.entries(classificadas)) {
  console.log(`  ${tipo}: ${qtd}`);
}
