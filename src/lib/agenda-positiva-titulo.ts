/**
 * Agenda Positiva: acha o grupo cliente de um evento do Outlook que ninguém
 * classificou no SAMA, pelo título. Conservador de propósito — melhor deixar de
 * contar do que pôr reunião no grupo errado:
 *  - o nome do grupo (sem "Grupo ") tem que aparecer inteiro no título, como
 *    palavras ("[MIX ETIQUETAS] REUNIÃO" → Grupo Mix Etiquetas);
 *  - sigla de 3 letras só vale escrita em maiúsculas ("Reunião BFD");
 *  - etiqueta entre colchetes pode ser o começo ou o fim do nome de um único
 *    grupo ("[BURITIS]" → Grupo Laticínios Buritis);
 *  - despacho, audiência, prazo e lembretes não são reunião.
 */

export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Grupo M.M.P" → "mmp"; "Grupo Laticínios Buritis" → "laticinios buritis". */
function nucleoDoGrupo(s: string): string {
  return normalizarTexto(s)
    .replace(/^grupo /, "")
    .replace(/\b([a-z0-9]) (?=[a-z0-9]\b)/g, "$1");
}

/** Nomes de grupo que também são palavras comuns em título de agenda. */
const NUCLEOS_AMBIGUOS = new Set(["one", "transportes", "prospect"]);

const NAO_E_REUNIAO =
  /^(despacho|aud|audiencia|pericia|prazo|lembrete|agendar|enviar|iniciar|ligar|faturar|day off|ferias)\b/;

/** Palavras que, sozinhas, já indicam reunião (sem precisar de convidado externo). */
const PALAVRA_DE_REUNIAO =
  /\b(reuniao|reunioes|call|ligacao|almoco|jantar|cafe|presencial|online|visita|mediacao|sessao|assembleia|onboarding|kick off|kickoff|apresentacao|conversa|encontro|meet|meeting|fup|follow up)\b/;

export function tituloTemPalavraDeReuniao(titulo: string): boolean {
  return PALAVRA_DE_REUNIAO.test(normalizarTexto(titulo));
}

export function criarCasadorDeGrupo(grupos: string[]): (titulo: string) => string | null {
  const indice = grupos
    .map((g) => ({ grupo: g, nucleo: nucleoDoGrupo(g) }))
    .filter((x) => x.nucleo.length >= 3 && !NUCLEOS_AMBIGUOS.has(x.nucleo));

  return (titulo: string) => {
    const t = titulo.trim();
    if (!t) return null;
    const semEtiqueta = t.replace(/^\s*\[[^\]]*\]\s*/, "");
    if (NAO_E_REUNIAO.test(normalizarTexto(t)) || NAO_E_REUNIAO.test(normalizarTexto(semEtiqueta))) {
      return null;
    }

    const texto = ` ${nucleoDoGrupo(t)} `;
    const siglas = new Set((t.match(/\b[A-Z0-9]{3}\b/g) ?? []).map((s) => s.toLowerCase()));
    let achados = indice.filter(
      (x) =>
        texto.includes(` ${x.nucleo} `) && (x.nucleo.length >= 4 || siglas.has(x.nucleo))
    );

    if (achados.length === 0) {
      const etiqueta = t.match(/\[([^\]]+)\]/)?.[1];
      const e = etiqueta ? nucleoDoGrupo(etiqueta) : "";
      if (e.length >= 3) {
        const parciais = indice.filter(
          (x) => x.nucleo.startsWith(`${e} `) || x.nucleo.endsWith(` ${e}`)
        );
        if (parciais.length === 1) achados = parciais;
      }
    }

    // "Reunião BFD e Multiplica" cai no nome mais longo citado.
    achados.sort((a, b) => b.nucleo.length - a.nucleo.length);
    return achados[0]?.grupo ?? null;
  };
}
