/**
 * Classifica tarefas VIOS "Ciência NF" já importadas (cria atividade + vínculo).
 * Uso: node scripts/classificar-ciencia-nf.mjs
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

function normalizeNomeCompare(value) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function isTarefaCienciaNf(t) {
  const alvo = "ciencia nf";
  for (const raw of [t.tarefa, t.tarefa_pai]) {
    const norm = normalizeNomeCompare(raw);
    if (norm === alvo || norm.endsWith(` ${alvo}`) || norm.startsWith(`${alvo} `)) {
      return true;
    }
  }
  return false;
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

function tituloCompleto(t) {
  const tarefa = (t.tarefa ?? "").trim();
  const pai = (t.tarefa_pai ?? "").trim();
  if (tarefa && pai && normalizeNomeCompare(tarefa) !== normalizeNomeCompare(pai)) {
    return `${tarefa} · ${pai}`;
  }
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
  (t) => isTarefaCienciaNf(t) && t.usuario_concluiu_id
);

console.log(`Ciência NF pendentes de classificar: ${alvo.length}`);

let criadas = 0;
const agora = new Date().toISOString();

for (const t of alvo) {
  const inicioLocal = tarefaDataHoraConclusao(t);
  const inicio = inicioLocal
    ? new Date(inicioLocal).toISOString()
    : new Date().toISOString();

  const { data: atv, error: insErr } = await supabase
    .from("atividades_internas")
    .insert({
      titulo: tituloCompleto(t),
      tipo: "CIENCIA_NF",
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
    console.error("Erro ao criar atividade CI", t.ci, insErr?.message);
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
    console.error("Erro ao vincular tarefa CI", t.ci, updErr.message);
    continue;
  }
  criadas++;
}

console.log(`Concluído: ${criadas} atividade(s) Ciência NF criada(s).`);
