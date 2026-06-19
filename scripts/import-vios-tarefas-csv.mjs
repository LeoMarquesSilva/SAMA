/**
 * Importa relatório CSV de tarefas do VIOS para o Supabase.
 * Por padrão: upsert incremental por CI (só novas e alteradas).
 * Apenas tarefas cumpridas por Sócio de Área e tipos mapeados no SAMA.
 *
 * Uso:
 *   node scripts/import-vios-tarefas-csv.mjs [caminho-do.csv]
 *   node scripts/import-vios-tarefas-csv.mjs --full [caminho]  # upsert tudo + limpa sem conclusor
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const fullReplace = args.includes("--full");
const csvPath =
  args.find((a) => !a.startsWith("--")) ??
  path.join(process.cwd(), "lista-de-tarefas-nv0.csv");

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
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
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

function cleanField(value) {
  let s = value.trim();
  if (s.startsWith('="') && s.endsWith('"')) return s.slice(2, -1).trim();
  if (s.startsWith("=")) s = s.slice(1).trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).trim();
  return s;
}

function parseViosCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ";") {
      row.push(cleanField(field));
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(cleanField(field));
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(cleanField(field));
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

function normHeader(h) {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerIndex(header, aliases) {
  const norm = header.map(normHeader);
  for (const alias of aliases) {
    const a = normHeader(alias);
    const exact = norm.findIndex((h) => h === a);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const a = normHeader(alias);
    const partial = norm.findIndex((h) => h.includes(a));
    if (partial >= 0) return partial;
  }
  return -1;
}

function parseDateBR(val) {
  if (!val) return null;
  const s = val.trim();
  if (!s || s === "00/00/0000") return null;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function splitNomes(val) {
  if (!val?.trim()) return [];
  return val.split(/\s*\|\s*/).map((n) => n.trim()).filter(Boolean);
}

function normalizeNomeCompare(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function nomesCorrespondem(nomeVios, nomeUsuario) {
  const a = normalizeNomeCompare(nomeVios);
  const b = normalizeNomeCompare(nomeUsuario);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(`${b} `) || b.startsWith(`${a} `)) return true;
  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  return shorter.length >= 2 && shorter.every((token) => longer.includes(token));
}

function findSocioConcluidor(nome, sociosArea) {
  if (!nome?.trim()) return null;
  return sociosArea.find((s) => nomesCorrespondem(nome, s.nome)) ?? null;
}

const TIPO_POR_NOME_NORM = Object.fromEntries(
  Object.entries(TIPO_POR_NOME).map(([nome, tipo]) => [normalizeNomeCompare(nome), tipo])
);

function tipoAtividadePorTarefaPai(t) {
  for (const raw of [t.tarefa_pai, t.tarefa]) {
    const norm = normalizeNomeCompare(raw ?? "");
    if (norm && TIPO_POR_NOME_NORM[norm]) return TIPO_POR_NOME_NORM[norm];
  }
  return null;
}

function isTarefaMapeada(t) {
  return tipoAtividadePorTarefaPai(t) !== null;
}

function parseTarefas(content) {
  const table = parseViosCsv(content);
  const header = table[0];
  const idx = {
    ci: headerIndex(header, ["ci"]),
    ci_processo: headerIndex(header, ["ci do processo"]),
    data_conclusao: headerIndex(header, ["data para conclusao"]),
    data_limite: headerIndex(header, ["data limite"]),
    horario: headerIndex(header, ["horario"]),
    nro_cnj: headerIndex(header, ["nro cnj"]),
    area: headerIndex(header, ["area do processo"]),
    objeto: headerIndex(header, ["objeto do processo"]),
    pasta: headerIndex(header, ["pasta"]),
    pasta_cliente: headerIndex(header, ["pasta cliente"]),
    tarefa_pai: headerIndex(header, ["tarefa pai"]),
    tarefa: headerIndex(header, ["tarefa"]),
    descricao: headerIndex(header, ["descricao"]),
    comentarios: headerIndex(header, ["comentarios"]),
    historico: headerIndex(header, ["historico"]),
    grupo: headerIndex(header, ["grupo cliente"]),
    cliente: headerIndex(header, ["cliente"]),
    parte_ativa: headerIndex(header, ["parte ativa"]),
    parte_passiva: headerIndex(header, ["parte passiva"]),
    responsaveis: headerIndex(header, ["responsaveis"]),
    auxiliares: headerIndex(header, ["auxiliares"]),
    vios_status: headerIndex(header, ["status"]),
    usuario_concluiu: headerIndex(header, ["usuario que concluiu a tarefa"]),
    data_conclusao_real: headerIndex(header, ["data da conclusao"]),
    hora_conclusao: headerIndex(header, ["hora da conclusao"]),
  };

  const out = [];
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const pick = (i) => (i >= 0 && row[i]?.trim() ? row[i].trim() : null);
    const ci = pick(idx.ci);
    if (!ci) continue;
    const parteAtiva = pick(idx.parte_ativa);
    const partePassiva = pick(idx.parte_passiva);
    out.push({
      ci,
      ci_do_processo: pick(idx.ci_processo),
      data_para_conclusao: parseDateBR(pick(idx.data_conclusao)),
      data_limite: parseDateBR(pick(idx.data_limite)),
      horario: pick(idx.horario),
      nro_cnj: pick(idx.nro_cnj),
      area_do_processo: pick(idx.area),
      objeto_do_processo: pick(idx.objeto),
      pasta: pick(idx.pasta),
      pasta_cliente: pick(idx.pasta_cliente),
      tarefa_pai: pick(idx.tarefa_pai),
      tarefa: pick(idx.tarefa),
      descricao: pick(idx.descricao),
      cliente: pick(idx.cliente),
      grupo_cliente: pick(idx.grupo),
      partes_ativas: parteAtiva ? [parteAtiva] : [],
      partes_passivas: partePassiva ? [partePassiva] : [],
      comentarios: pick(idx.comentarios) ? [pick(idx.comentarios)] : [],
      historico: pick(idx.historico) ? [pick(idx.historico)] : [],
      responsaveis: splitNomes(pick(idx.responsaveis)),
      auxiliares: splitNomes(pick(idx.auxiliares)),
      vios_status: pick(idx.vios_status),
      usuario_concluiu: pick(idx.usuario_concluiu),
      data_conclusao: parseDateBR(pick(idx.data_conclusao_real)),
      hora_conclusao: pick(idx.hora_conclusao),
    });
  }
  return out;
}

/** Campos sincronizados do VIOS — usados para detectar alteração por CI. */
const SYNC_FIELDS = [
  "ci_do_processo",
  "data_para_conclusao",
  "data_limite",
  "horario",
  "nro_cnj",
  "area_do_processo",
  "objeto_do_processo",
  "pasta",
  "pasta_cliente",
  "tarefa_pai",
  "tarefa",
  "descricao",
  "cliente",
  "grupo_cliente",
  "partes_ativas",
  "partes_passivas",
  "comentarios",
  "historico",
  "responsaveis",
  "auxiliares",
  "vios_status",
  "usuario_concluiu",
  "usuario_concluiu_id",
  "data_conclusao",
  "hora_conclusao",
  "usuario_id",
];

function stableJson(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

function rowFingerprint(row) {
  return SYNC_FIELDS.map((k) => stableJson(row[k] ?? null)).join("\0");
}

function pickSyncFields(row) {
  const out = { ci: row.ci, sincronizado_em: row.sincronizado_em };
  for (const k of SYNC_FIELDS) out[k] = row[k] ?? null;
  return out;
}

if (!fs.existsSync(csvPath)) {
  console.error("Arquivo não encontrado:", csvPath);
  process.exit(1);
}

const content = fs.readFileSync(csvPath, "latin1");
const parsed = parseTarefas(content);
console.log("Linhas no CSV (com CI):", parsed.length);

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: usuarios } = await supabase.from("usuarios").select("id, nome, cargo");

const listaUsuarios = usuarios ?? [];
const sociosArea = listaUsuarios.filter((u) => u.cargo === "SOCIO_AREA");

if (sociosArea.length === 0) {
  console.error("Nenhum Sócio de Área cadastrado no SAMA.");
  process.exit(1);
}

function resolveUsuarioId(t) {
  for (const nome of [...t.responsaveis, ...t.auxiliares]) {
    const u = listaUsuarios.find((x) => nomesCorrespondem(nome, x.nome));
    if (u) return u.id;
  }
  return null;
}

const agora = new Date().toISOString();
const elegiveis = parsed
  .filter(isTarefaMapeada)
  .map((t) => {
    const socio = findSocioConcluidor(t.usuario_concluiu, sociosArea);
    if (!socio) return null;
    return {
      ...t,
      usuario_id: resolveUsuarioId(t),
      usuario_concluiu_id: socio.id,
      sincronizado_em: agora,
    };
  })
  .filter(Boolean);

console.log(
  "Elegíveis (mapa VIOS + Sócio de Área):",
  elegiveis.length,
  "de",
  parsed.length
);

const { data: existentes, error: fetchErr } = await supabase
  .from("vios_tarefas")
  .select(
    "ci, ci_do_processo, data_para_conclusao, data_limite, horario, nro_cnj, area_do_processo, objeto_do_processo, pasta, pasta_cliente, tarefa_pai, tarefa, descricao, cliente, grupo_cliente, partes_ativas, partes_passivas, comentarios, historico, responsaveis, auxiliares, vios_status, usuario_concluiu, usuario_concluiu_id, data_conclusao, hora_conclusao, usuario_id"
  );

if (fetchErr) {
  console.error("Erro ao ler tarefas existentes:", fetchErr.message);
  process.exit(1);
}

const porCi = new Map((existentes ?? []).map((r) => [String(r.ci), r]));

let novas = 0;
let alteradas = 0;
let inalteradas = 0;

const rows = fullReplace
  ? elegiveis
  : elegiveis.filter((row) => {
      const atual = porCi.get(String(row.ci));
      if (!atual) {
        novas++;
        return true;
      }
      if (rowFingerprint(row) !== rowFingerprint(atual)) {
        alteradas++;
        return true;
      }
      inalteradas++;
      return false;
    });

console.log(
  fullReplace
    ? `Modo completo: ${rows.length} tarefa(s) para upsert`
    : `Incremental: ${novas} nova(s), ${alteradas} alterada(s), ${inalteradas} sem mudança`
);

if (rows.length === 0) {
  console.log("Nada a importar.");
  process.exit(0);
}

const CHUNK = 100;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK).map(pickSyncFields);
  const { error } = await supabase.from("vios_tarefas").upsert(chunk, { onConflict: "ci" });
  if (error) {
    console.error("Erro no chunk", i, error.message);
    process.exit(1);
  }
  console.log(`Upsert ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
}

if (fullReplace) {
  await supabase.from("vios_tarefas").delete().is("usuario_concluiu_id", null);
}

await supabase.from("vios_sync_estado").upsert(
  {
    recurso: "tarefas",
    ultima_sincronia: agora,
    ultimo_erro: null,
    updated_at: agora,
  },
  { onConflict: "recurso" }
);

const { count } = await supabase
  .from("vios_tarefas")
  .select("id", { count: "exact", head: true });

console.log("Concluído:", rows.length, "upsert(s) · total no banco:", count ?? "?");
