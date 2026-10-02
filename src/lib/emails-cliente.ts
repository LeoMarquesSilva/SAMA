/**
 * E-mails do cliente no espelho do VIOS: o campo `pessoas.email` guarda o
 * principal e os opcionais no mesmo texto, separados por `;`, `,`, `/` ou quebra
 * de linha. O SAMA mostrava a string crua, então os opcionais sumiam.
 */

const SEPARADOR = /[;,/|\s]+/;

export function separarEmails(bruto: string | null | undefined): string[] {
  const texto = (bruto ?? "").trim();
  if (!texto) return [];

  const vistos = new Set<string>();
  const out: string[] = [];
  for (const parte of texto.split(SEPARADOR)) {
    const email = parte.trim().replace(/^<|>$/g, "");
    if (!email.includes("@") || email.length < 5) continue;
    const chave = email.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(email);
  }
  return out;
}

/** Rótulo para a ficha do cliente: principal e, entre parênteses, os opcionais. */
export function rotuloEmailsCliente(bruto: string | null | undefined): string | null {
  const lista = separarEmails(bruto);
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];
  return `${lista[0]} (+${lista.length - 1})`;
}
