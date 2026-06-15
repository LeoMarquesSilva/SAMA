/** Parser do relatório CSV de tarefas exportado manualmente do VIOS. */

export type ViosTarefaCsvRow = {
  ci: string;
  ci_do_processo: string | null;
  data_para_conclusao: string | null;
  data_limite: string | null;
  horario: string | null;
  nro_cnj: string | null;
  area_do_processo: string | null;
  objeto_do_processo: string | null;
  pasta: string | null;
  pasta_cliente: string | null;
  tarefa_pai: string | null;
  tarefa: string | null;
  descricao: string | null;
  cliente: string | null;
  grupo_cliente: string | null;
  partes_ativas: string[];
  partes_passivas: string[];
  comentarios: string[];
  historico: string[];
  responsaveis: string[];
  auxiliares: string[];
  vios_status: string | null;
  usuario_concluiu: string | null;
  data_conclusao: string | null;
  hora_conclusao: string | null;
};

function cleanField(value: string): string {
  let s = value.trim();
  if (s.startsWith('="') && s.endsWith('"')) return s.slice(2, -1).trim();
  if (s.startsWith("=")) s = s.slice(1).trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).trim();
  return s;
}

/** Parse CSV VIOS (;), respeitando aspas e quebras de linha dentro de campos. */
export function parseViosCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ";") {
      row.push(cleanField(field));
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(cleanField(field));
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(cleanField(field));
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  return rows;
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerIndex(header: string[], aliases: string[]): number {
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

/** DD/MM/YYYY → YYYY-MM-DD */
export function parseDateBR(val: string | null | undefined): string | null {
  if (!val) return null;
  const s = val.trim();
  if (!s || s === "00/00/0000") return null;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function splitNomes(val: string | null | undefined): string[] {
  if (!val?.trim()) return [];
  return val
    .split(/\s*\|\s*/)
    .map((n) => n.trim())
    .filter(Boolean);
}

function splitTextoLista(val: string | null | undefined): string[] {
  if (!val?.trim()) return [];
  return [val.trim()];
}

function pick(row: string[], idx: number): string | null {
  if (idx < 0) return null;
  const v = row[idx]?.trim();
  return v || null;
}

/** Decodifica buffer exportado pelo VIOS (Windows-1252 / latin1). */
export function decodeViosCsvBuffer(buffer: ArrayBuffer | Buffer): string {
  const bytes =
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return new TextDecoder("latin1").decode(bytes);
}

export function parseViosTarefasCsv(content: string): ViosTarefaCsvRow[] {
  const table = parseViosCsv(content);
  if (table.length < 2) return [];

  const header = table[0];
  const idx = {
    ci: headerIndex(header, ["ci"]),
    ci_processo: headerIndex(header, ["ci do processo"]),
    data_para_conclusao: headerIndex(header, ["data para conclusao"]),
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
    usuario_concluiu: headerIndex(header, [
      "usuario que concluiu a tarefa",
    ]),
    data_conclusao: headerIndex(header, ["data da conclusao"]),
    hora_conclusao: headerIndex(header, ["hora da conclusao"]),
  };

  const out: ViosTarefaCsvRow[] = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const ci = pick(row, idx.ci);
    if (!ci) continue;

    const parteAtiva = pick(row, idx.parte_ativa);
    const partePassiva = pick(row, idx.parte_passiva);

    out.push({
      ci,
      ci_do_processo: pick(row, idx.ci_processo),
      data_para_conclusao: parseDateBR(pick(row, idx.data_para_conclusao)),
      data_limite: parseDateBR(pick(row, idx.data_limite)),
      horario: pick(row, idx.horario),
      nro_cnj: pick(row, idx.nro_cnj),
      area_do_processo: pick(row, idx.area),
      objeto_do_processo: pick(row, idx.objeto),
      pasta: pick(row, idx.pasta),
      pasta_cliente: pick(row, idx.pasta_cliente),
      tarefa_pai: pick(row, idx.tarefa_pai),
      tarefa: pick(row, idx.tarefa),
      descricao: pick(row, idx.descricao),
      cliente: pick(row, idx.cliente),
      grupo_cliente: pick(row, idx.grupo),
      partes_ativas: parteAtiva ? [parteAtiva] : [],
      partes_passivas: partePassiva ? [partePassiva] : [],
      comentarios: splitTextoLista(pick(row, idx.comentarios)),
      historico: splitTextoLista(pick(row, idx.historico)),
      responsaveis: splitNomes(pick(row, idx.responsaveis)),
      auxiliares: splitNomes(pick(row, idx.auxiliares)),
      vios_status: pick(row, idx.vios_status),
      usuario_concluiu: pick(row, idx.usuario_concluiu),
      data_conclusao: parseDateBR(pick(row, idx.data_conclusao)),
      hora_conclusao: pick(row, idx.hora_conclusao),
    });
  }

  return out;
}

export function csvRowToDbRow(
  t: ViosTarefaCsvRow,
  usuarioId: string | null,
  usuarioConcluiuId: string | null,
  sincronizadoEm = new Date().toISOString()
) {
  return {
    ci: t.ci,
    ci_do_processo: t.ci_do_processo,
    data_para_conclusao: t.data_para_conclusao,
    data_limite: t.data_limite,
    horario: t.horario,
    nro_cnj: t.nro_cnj,
    area_do_processo: t.area_do_processo,
    objeto_do_processo: t.objeto_do_processo,
    pasta: t.pasta,
    pasta_cliente: t.pasta_cliente,
    tarefa_pai: t.tarefa_pai,
    tarefa: t.tarefa,
    descricao: t.descricao,
    cliente: t.cliente,
    grupo_cliente: t.grupo_cliente,
    partes_ativas: t.partes_ativas,
    partes_passivas: t.partes_passivas,
    comentarios: t.comentarios,
    historico: t.historico,
    responsaveis: t.responsaveis,
    auxiliares: t.auxiliares,
    vios_status: t.vios_status,
    usuario_concluiu: t.usuario_concluiu,
    usuario_concluiu_id: usuarioConcluiuId,
    data_conclusao: t.data_conclusao,
    hora_conclusao: t.hora_conclusao,
    usuario_id: usuarioId,
    sincronizado_em: sincronizadoEm,
  };
}
