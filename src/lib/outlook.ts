// Limpeza do corpo de eventos do Outlook/Teams para exibição.

// Linhas de boilerplate que o Teams/Outlook injeta no corpo do convite.
const BOILERPLATE = [
  /microsoft teams/i,
  /reuni[ãa]o do microsoft teams/i,
  /ingress(e|ar) (no|pelo|na) (computador|aplicativo|web|dispositivo)/i,
  /join on your computer/i,
  /join the meeting now/i,
  /clique aqui para (ingressar|participar|entrar)/i,
  /click here to join/i,
  /id da reuni[ãa]o:/i,
  /meeting id:/i,
  /^senha:/i,
  /^passcode:/i,
  /baixe o teams/i,
  /download teams/i,
  /ingressar na web/i,
  /join on the web/i,
  /op[çc][õo]es de reuni[ãa]o/i,
  /meeting options/i,
  /^saiba mais/i,
  /^learn more/i,
  /precisa de ajuda/i,
  /need help/i,
  /por telefone/i,
  /dial[- ]?in/i,
  /para organizadores/i,
  /for organizers/i,
];

/**
 * Remove o boilerplate do Teams do corpo do evento:
 * tudo a partir da primeira linha-separador (_____) é descartado,
 * e linhas conhecidas de convite são filtradas. Retorna null se sobrar nada.
 */
export function limparCorpoOutlook(
  texto: string | null | undefined
): string | null {
  if (!texto) return null;

  const linhas = texto.split(/\r?\n/);
  const mantidas: string[] = [];
  for (const linha of linhas) {
    const t = linha.trim();
    // separador horizontal → daqui em diante é o bloco do Teams
    if (/^_{5,}\s*$/.test(t)) break;
    if (BOILERPLATE.some((p) => p.test(t))) continue;
    mantidas.push(linha);
  }

  const resultado = mantidas
    .join("\n")
    .replace(/_{5,}/g, " ") // sequências soltas no meio do texto
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return resultado || null;
}
