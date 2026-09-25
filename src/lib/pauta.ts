export type PautaAssunto = {
  titulo: string;
  descricao: string;
};

export type PautaReuniao = {
  objetivo: string;
  assuntos: PautaAssunto[];
  pendencias: string;
};

export const PAUTA_VAZIA: PautaReuniao = {
  objetivo: "",
  assuntos: [{ titulo: "", descricao: "" }],
  pendencias: "",
};

export function pautaVazia(): PautaReuniao {
  return {
    objetivo: "",
    assuntos: [{ titulo: "", descricao: "" }],
    pendencias: "",
  };
}

export function parsePauta(raw: unknown): PautaReuniao {
  if (!raw || typeof raw !== "object") return pautaVazia();
  const o = raw as Partial<PautaReuniao>;
  const assuntos = Array.isArray(o.assuntos)
    ? o.assuntos
        .map((a) => ({
          titulo: String(a?.titulo ?? "").trim(),
          descricao: String(a?.descricao ?? "").trim(),
        }))
        .filter((a) => a.titulo || a.descricao)
    : [];
  return {
    objetivo: String(o.objetivo ?? "").trim(),
    assuntos: assuntos.length ? assuntos : [{ titulo: "", descricao: "" }],
    pendencias: String(o.pendencias ?? "").trim(),
  };
}

/** Pauta estruturada ou, se vazia, o resumo da reunião anterior. */
export function pautaDeReuniaoAnterior(opts: {
  pauta: unknown;
  resultado?: string | null;
  titulo?: string | null;
  quando?: string | null;
}): PautaReuniao {
  const [dia, hora] = (opts.quando ?? "").split(/\s+/);
  const cabecalho =
    dia && hora
      ? `Última pauta do dia ${dia}, às ${hora}`
      : dia
        ? `Última pauta do dia ${dia}`
        : "Última pauta";
  const parsed = parsePauta(opts.pauta);
  if (pautaTemConteudo(parsed)) {
    const corpo = parsed.objetivo.trim();
    return {
      ...parsed,
      objetivo: corpo ? `${cabecalho}\n\n${corpo}` : cabecalho,
    };
  }
  const resumo = opts.resultado?.trim();
  if (!resumo) return parsed;
  return {
    objetivo: `${cabecalho}\n\n${resumo}`,
    assuntos: [{ titulo: "", descricao: "" }],
    pendencias: "",
  };
}

export function pautaTemConteudo(pauta: PautaReuniao | null | undefined): boolean {
  if (!pauta) return false;
  return Boolean(
    pauta.objetivo.trim() ||
      pauta.pendencias.trim() ||
      pauta.assuntos.some((a) => a.titulo.trim() || a.descricao.trim())
  );
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nlToBr(s: string): string {
  return escHtml(s).replace(/\r?\n/g, "<br/>");
}

/** Corpo HTML do convite Outlook (F2.4) — modelo Reestruturação. */
export function pautaParaHtmlConvite(opts: {
  titulo: string;
  cliente?: string | null;
  dataHora?: string | null;
  participantes?: string[];
  responsavel?: string | null;
  pauta: PautaReuniao;
}): string {
  const assuntos = opts.pauta.assuntos
    .filter((a) => a.titulo.trim() || a.descricao.trim())
    .map(
      (a, i) =>
        `<p><strong>2.${i + 1}. ${escHtml(a.titulo || "Assunto")}</strong><br/>${nlToBr(a.descricao)}</p>`
    )
    .join("");

  const participantes = (opts.participantes ?? [])
    .filter(Boolean)
    .map(escHtml)
    .join(", ");

  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#1e293b">
<h2 style="margin:0 0 12px">Pauta de reunião</h2>
<p><strong>Título:</strong> ${escHtml(opts.titulo)}</p>
${opts.cliente ? `<p><strong>Cliente:</strong> ${escHtml(opts.cliente)}</p>` : ""}
${opts.dataHora ? `<p><strong>Data/horário:</strong> ${escHtml(opts.dataHora)}</p>` : ""}
${participantes ? `<p><strong>Participantes:</strong> ${participantes}</p>` : ""}
${opts.responsavel ? `<p><strong>Responsável:</strong> ${escHtml(opts.responsavel)}</p>` : ""}
<hr/>
<h3>1. Objetivo da reunião</h3>
<p>${nlToBr(opts.pauta.objetivo) || "—"}</p>
<h3>2. Assuntos a serem tratados</h3>
${assuntos || "<p>—</p>"}
<h3>3. Pendências / pontos para decisão</h3>
<p>${nlToBr(opts.pauta.pendencias) || "—"}</p>
</div>`;
}
