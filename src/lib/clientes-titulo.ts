/** Palavras comuns em títulos de reunião que não identificam cliente. */
const STOPWORDS = new Set([
  "reunião",
  "reuniao",
  "call",
  "meeting",
  "acompanhamento",
  "follow",
  "up",
  "followup",
  "comitê",
  "comite",
  "indicadores",
  "status",
  "semanal",
  "mensal",
  "quinzenal",
  "trimestral",
  "interno",
  "interna",
  "teams",
  "zoom",
  "online",
  "on-line",
  "on",
  "line",
  "presencial",
  "alinhamento",
  "sync",
  "kickoff",
  "kick",
  "off",
]);

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function removerParenteses(s: string): string {
  return s
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limparSegmento(s: string): string {
  return removerParenteses(s)
    .replace(
      /^(reuni[aã]o|call|meeting|acompanhamento|follow[\s-]?up|comit[eê])\s*(de|com|sobre|[-–])?\s*/gi,
      ""
    )
    .replace(/\s*(semanal|mensal|quinzenal|trimestral)\s*$/gi, "")
    .trim();
}

/** Separadores típicos entre cliente e tipo de reunião (não hífen dentro de palavra). */
const SEPARADOR_TITULO = /\s+[-–—|/]\s+|\s*[|/:\\·]\s+/;

/** Extrai trechos do título que podem ser grupo ou empresa do cliente. */
export function candidatosTituloReuniao(titulo: string): string[] {
  const raw = titulo.trim();
  if (raw.length < 2) return [];

  const base = removerParenteses(raw);
  const partes = base
    .split(SEPARADOR_TITULO)
    .map((p) => limparSegmento(p.trim()))
    .filter((p) => p.length >= 2);

  const inteiro = limparSegmento(base);
  const candidatos = [...partes, inteiro, base, raw];

  const vistos = new Set<string>();
  const out: string[] = [];

  for (const c of candidatos.sort((a, b) => b.length - a.length)) {
    const limpo = limparSegmento(c);
    if (limpo.length >= 2 && limpo !== c) {
      const chaveL = normalizar(limpo);
      if (!vistos.has(chaveL)) {
        const tokensL = chaveL.split(/\s+/).filter((t) => t.length >= 2);
        if (
          tokensL.length > 0 &&
          !(tokensL.length === 1 && STOPWORDS.has(tokensL[0])) &&
          !tokensL.every((t) => STOPWORDS.has(t))
        ) {
          vistos.add(chaveL);
          out.push(limpo);
        }
      }
    }

    const chave = normalizar(c);
    if (chave.length < 2 || vistos.has(chave)) continue;
    if (/[()[\]]/.test(c)) continue;
    const tokens = chave.split(/\s+/).filter((t) => t.length >= 2);
    if (tokens.length === 1 && STOPWORDS.has(tokens[0])) continue;
    if (tokens.every((t) => STOPWORDS.has(t))) continue;
    vistos.add(chave);
    out.push(c);
  }

  return out;
}

export function pontuarClienteNoTitulo(
  candidato: string,
  cliente: {
    nome: string;
    grupo_cliente?: string | null;
    kind?: "grupo" | "empresa";
  }
): number {
  const cand = normalizar(candidato);
  if (cand.length < 2) return 0;

  const grupo = normalizar(cliente.grupo_cliente ?? "");
  const nome = normalizar(cliente.nome);

  if (cliente.kind === "grupo" && grupo) {
    if (grupo === cand) return 100;
    if (grupo.startsWith(cand)) return 88;
    if (cand.includes(grupo) && grupo.length >= 3) return 82;
    if (grupo.includes(cand) && cand.length >= 3) return 72;
    const grupoSemPrefixo = grupo.replace(/^grupo\s+/, "");
    if (grupoSemPrefixo === cand) return 98;
    if (grupoSemPrefixo.startsWith(cand) && cand.length >= 3) return 86;
    if (grupoSemPrefixo.includes(cand) && cand.length >= 3) return 74;
  }

  if (grupo && grupo === cand) return 96;
  if (grupo && grupo.includes(cand) && cand.length >= 4) return 78;
  if (nome === cand) return 92;
  if (nome.includes(cand) && cand.length >= 4) return 62;
  if (grupo && cand.includes(grupo) && grupo.length >= 4) return 70;

  return 0;
}

export const PONTUACAO_MINIMA_SUGESTAO = 65;
