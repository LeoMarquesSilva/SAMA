/**
 * Bloco "Reunião do Microsoft Teams" que o Outlook acrescenta ao fim do corpo
 * do evento (link de ingresso, ID e senha, entre duas linhas de traços).
 *
 * O Outlook lê o Teams desse bloco: um PATCH que troca o corpo inteiro sem ele
 * desliga a reunião online (`isOnlineMeeting` volta false e o link some do
 * convite dos participantes). Por isso, ao atualizar o corpo, o bloco atual é
 * lido e colado de volta.
 */

const TRACOS = /_{30,}/;
const MARCA_TEAMS = /meet_invite_block|teams\.microsoft\.com\/l\/meetup-join/i;

/** Trecho do Teams no corpo do evento, ou null se não houver. */
export function extrairBlocoTeams(html: string | null | undefined): string | null {
  if (!html) return null;
  const tracos = html.search(TRACOS);
  if (tracos < 0) return null;

  // O bloco novo vem num <div class="me-email-text">; o antigo, num <div> com os traços.
  const wrapper = html.lastIndexOf('<div class="me-email-text"', tracos);
  const inicio =
    wrapper >= 0 && tracos - wrapper < 2000 ? wrapper : html.lastIndexOf("<div", tracos);
  if (inicio < 0) return null;

  const fimBody = html.toLowerCase().lastIndexOf("</body>");
  const bloco = html.slice(inicio, fimBody > inicio ? fimBody : undefined).trim();
  return MARCA_TEAMS.test(bloco) ? bloco : null;
}

/** Cola o bloco do Teams no fim do corpo novo (antes do </body>, se houver). */
export function anexarBlocoTeams(html: string, bloco: string | null): string {
  if (!bloco || MARCA_TEAMS.test(html)) return html;
  const fimBody = html.toLowerCase().lastIndexOf("</body>");
  return fimBody >= 0
    ? `${html.slice(0, fimBody)}<br>\n${bloco}\n${html.slice(fimBody)}`
    : `${html}<br>\n${bloco}`;
}
