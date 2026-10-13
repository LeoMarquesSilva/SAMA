/**
 * E-mails que o SAMA manda em nome do escritório (convite da reunião e ata),
 * na identidade visual Bismarchi | Pires: marinho, dourado e creme.
 *
 * Sem dependência de servidor: o modal da ata monta a prévia em tempo real com
 * as mesmas funções do envio.
 *
 * Regras para renderizar igual no Outlook (motor do Word), Gmail e iPhone:
 * layout em tabelas, estilos inline, cor de fundo por `bgcolor`, nada de fonte
 * web (o Outlook troca por Times). As fontes da marca (Gobold/Gotham) só
 * aparecem no logo, em imagem; títulos em Georgia e texto em Segoe UI/Helvetica.
 */
import { isEmailEscritorio } from "@/lib/email-escritorio";
import { normalizarMarkdown } from "@/lib/markdown-editor";
import type { PautaReuniao } from "@/lib/pauta";
import { APP_TIMEZONE } from "@/lib/timezone";

const COR = {
  marinho: "#0d1e2e",
  /**
   * Texto em preto quente, quase neutro. O modo escuro do Outlook inverte a
   * claridade e mantém o tom: marinho virava azul-claro; este vira creme.
   */
  tinta: "#23211e",
  ouro: "#d4b070",
  /** Dourado para números grandes sobre branco (contraste 3,4:1). */
  ouroEscuro: "#a8853f",
  /** Dourado para texto pequeno sobre branco ou creme (contraste 6:1). */
  ouroTexto: "#7a5e26",
  creme: "#fcf9f5",
  fundo: "#f4f0e8",
  borda: "#e8dfd0",
  linha: "#efe8db",
  texto: "#2b2926",
  suave: "#5f5a53",
} as const;

const SANS = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

// ─── Imagens ────────────────────────────────────────────────────────────────

/**
 * Cabeçalho e rodapé são imagens com o marinho e o logo embutidos. O modo
 * escuro do Outlook e do Teams inverte cores de fundo e de texto, mas não
 * imagens: assim a faixa da marca fica igual nos dois modos, e todo texto
 * fica sobre o fundo claro, que inverte de forma limpa.
 */
export type ImagensEmail = { cabecalho: string; rodape: string };

/** Content-IDs quando as imagens vão como anexo inline. */
export const IMAGENS_CID = {
  cabecalho: "cabecalho-bismarchi-pires",
  rodape: "rodape-bismarchi-pires",
} as const;

export function imagensInline(): ImagensEmail {
  return {
    cabecalho: `cid:${IMAGENS_CID.cabecalho}`,
    rodape: `cid:${IMAGENS_CID.rodape}`,
  };
}

/** Mesmas imagens servidas pelo SAMA (public/email). */
export function imagensPublicas(base = ""): ImagensEmail {
  const raiz = base.replace(/\/$/, "");
  return {
    cabecalho: `${raiz}/email/cabecalho.png`,
    rodape: `${raiz}/email/rodape.png`,
  };
}

// ─── Destinatários e assunto ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clientes primeiro; a equipe interna entra em cópia. */
export function separarDestinatarios(emails: string[]) {
  const vistos = new Set<string>();
  const para: string[] = [];
  const cc: string[] = [];
  for (const bruto of emails) {
    const email = bruto.trim();
    if (!EMAIL_RE.test(email)) continue;
    const chave = email.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    (isEmailEscritorio(email) ? cc : para).push(email);
  }
  return { para, cc };
}

/** Na ata, com só gente do escritório na lista, ela vira o destinatário principal. */
export function destinatariosAta(emails: string[]) {
  const separados = separarDestinatarios(emails);
  return separados.para.length > 0 ? separados : { para: separados.cc, cc: [] };
}

export function assuntoAta(titulo: string): string {
  return `Ata da reunião — ${titulo.trim() || "Reunião"}`;
}

export function assuntoPauta(titulo: string): string {
  return `Pauta da reunião — ${titulo.trim() || "Reunião"}`;
}

// ─── Utilitários ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataValida(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatar(d: Date, opcoes: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, ...opcoes }).format(d);
}

/** "Terça-feira, 20 de outubro de 2026" (fuso SP). */
function dataComSemana(d: Date): string {
  return maiuscula(
    formatar(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );
}

/** "20 de outubro de 2026" (fuso SP). */
function dataPorExtenso(d: Date): string {
  return formatar(d, { day: "numeric", month: "long", year: "numeric" });
}

function hora(d: Date): string {
  return formatar(d, { hour: "2-digit", minute: "2-digit" });
}

/** Partes da folhinha: "OUT", "20", "TER". */
function folhinha(d: Date) {
  const curto = (o: Intl.DateTimeFormatOptions) =>
    formatar(d, o).replace(".", "").slice(0, 3).toUpperCase();
  return { mes: curto({ month: "short" }), dia: formatar(d, { day: "numeric" }), semana: curto({ weekday: "short" }) };
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => !/^(d[aeo]s?|e)$/i.test(p));
  const letras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  return letras.map((p) => p.charAt(0).toUpperCase()).join("") || "·";
}

// ─── Texto livre (markdown simples do editor) → HTML de e-mail ───────────────

const ITEM_LISTA = /^\s*[-•*–]\s+(.*)$/;
const ITEM_NUMERADO = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const TITULO_MD = /^\s*#{1,3}\s+(.+?)\s*#*\s*$/;
const TITULO_NEGRITO = /^\s*\*\*([^*]{1,90})\*\*:?\s*$/;

function inline(texto: string): string {
  return esc(texto)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:700;color:${COR.tinta};">$1</strong>`)
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
}

type OpcoesTexto = { espaco?: number; tamanho?: number; cor?: string };

function estiloParagrafo(o: Required<OpcoesTexto>): string {
  return `margin:0 0 ${o.espaco}px;font-family:${SANS};font-size:${o.tamanho}px;line-height:${Math.round(o.tamanho * 1.65)}px;color:${o.cor};mso-line-height-rule:exactly;`;
}

/** Lista em tabela: marcador dourado igual em todo cliente de e-mail. */
function listaHtml(
  tipo: "ul" | "ol",
  inicio: number,
  itens: string[],
  o: Required<OpcoesTexto>
): string {
  const altura = Math.round(o.tamanho * 1.6);
  const linhas = itens
    .map((item, i) => {
      const marcador =
        tipo === "ul"
          ? `<td width="22" valign="top" style="width:22px;font-family:${SANS};font-size:${o.tamanho + 3}px;line-height:${altura}px;color:${COR.ouroEscuro};mso-line-height-rule:exactly;">&#8226;</td>`
          : `<td width="28" valign="top" style="width:28px;font-family:${SERIF};font-size:${o.tamanho}px;line-height:${altura}px;color:${COR.ouroEscuro};mso-line-height-rule:exactly;">${inicio + i}.</td>`;
      return `<tr>${marcador}<td valign="top" style="padding:0 0 8px;font-family:${SANS};font-size:${o.tamanho}px;line-height:${altura}px;color:${o.cor};mso-line-height-rule:exactly;">${inline(item)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${Math.max(o.espaco - 8, 0)}px;">${linhas}</table>`;
}

/**
 * Parágrafos (linha em branco separa), quebras simples, listas com `-`/`•`/`1.`,
 * **negrito** e *itálico*. Linha só em negrito ou com `#` vira subtítulo.
 */
export function textoParaHtmlEmail(texto: string, opts?: OpcoesTexto): string {
  const o: Required<OpcoesTexto> = {
    espaco: opts?.espaco ?? 18,
    tamanho: opts?.tamanho ?? 15,
    cor: opts?.cor ?? COR.texto,
  };
  const linhas = normalizarMarkdown(texto.replace(/\r\n?/g, "\n")).split("\n");
  const blocos: string[] = [];
  let paragrafo: string[] = [];
  let lista: { tipo: "ul" | "ol"; inicio: number; itens: string[] } | null = null;

  const subtitulo = (t: string) =>
    `<p style="margin:${blocos.length ? 30 : 0}px 0 12px;font-family:${SERIF};font-size:20px;line-height:28px;font-weight:normal;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(t.trim())}</p>`;

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return;
    const titulo = paragrafo.length === 1 ? paragrafo[0].match(TITULO_NEGRITO) : null;
    blocos.push(
      titulo
        ? subtitulo(titulo[1])
        : `<p style="${estiloParagrafo(o)}">${paragrafo.map(inline).join("<br/>")}</p>`
    );
    paragrafo = [];
  };

  const fecharLista = () => {
    if (!lista) return;
    blocos.push(listaHtml(lista.tipo, lista.inicio, lista.itens, o));
    lista = null;
  };

  for (const linha of linhas) {
    if (!linha.trim()) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const tituloMd = linha.match(TITULO_MD);
    if (tituloMd) {
      fecharParagrafo();
      fecharLista();
      blocos.push(subtitulo(tituloMd[1].replace(/\*\*/g, "")));
      continue;
    }
    const marcador = linha.match(ITEM_LISTA);
    const numero = marcador ? null : linha.match(ITEM_NUMERADO);
    if (marcador || numero) {
      fecharParagrafo();
      const tipo = marcador ? "ul" : "ol";
      if (lista && lista.tipo !== tipo) fecharLista();
      lista ??= { tipo, inicio: numero ? Number(numero[1]) : 1, itens: [] };
      lista.itens.push(marcador ? marcador[1] : numero![2]);
      continue;
    }
    fecharLista();
    paragrafo.push(linha);
  }
  fecharParagrafo();
  fecharLista();
  return blocos.join("\n");
}

// ─── Peças do layout ────────────────────────────────────────────────────────

/** Caixa alta no próprio texto: o editor do Outlook descarta `text-transform`. */
function caixaAlta(texto: string): string {
  return texto.toLocaleUpperCase("pt-BR");
}

/** Rótulo pequeno em caixa alta, espaçado (eco do Gotham do logo). */
function rotulo(texto: string, cor: string = COR.ouroTexto, margem = "0 0 4px"): string {
  return `<p style="margin:${margem};font-family:${SANS};font-size:10px;line-height:14px;font-weight:700;letter-spacing:2px;color:${cor};mso-line-height-rule:exactly;">${esc(caixaAlta(texto))}</p>`;
}

/** Título de seção com fio fino embaixo. */
function secao(texto: string, margemTopo = 34): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${margemTopo}px 0 18px;"><tr><td style="padding:0 0 10px;border-bottom:1px solid ${COR.borda};font-family:${SANS};font-size:11px;line-height:14px;font-weight:700;letter-spacing:2.5px;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(caixaAlta(texto))}</td></tr></table>`;
}

const FIO_OURO = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td width="40" height="2" bgcolor="${COR.ouro}" style="width:40px;height:2px;background-color:${COR.ouro};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

/** Bloco "folhinha" do calendário: mês, dia e dia da semana, com fio dourado no topo. */
function blocoData(d: Date): string {
  const f = folhinha(d);
  return `<table role="presentation" width="78" cellpadding="0" cellspacing="0" border="0" style="width:78px;border:1px solid ${COR.borda};border-top:3px solid ${COR.ouro};">
<tr><td align="center" style="padding:9px 0 0;font-family:${SANS};font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;color:${COR.ouroTexto};mso-line-height-rule:exactly;">${f.mes}</td></tr>
<tr><td align="center" style="padding:3px 0 0;font-family:${SERIF};font-size:34px;line-height:38px;color:${COR.tinta};mso-line-height-rule:exactly;">${f.dia}</td></tr>
<tr><td align="center" style="padding:2px 0 10px;font-family:${SANS};font-size:10px;line-height:14px;font-weight:700;letter-spacing:1.5px;color:${COR.suave};mso-line-height-rule:exactly;">${f.semana}</td></tr>
</table>`;
}

function linhaInfo(titulo: string, principal: string, detalhe?: string | null): string {
  return `${rotulo(titulo)}
<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:22px;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(principal)}${detalhe ? `<br/><span style="font-size:13px;line-height:20px;color:${COR.suave};">${esc(detalhe)}</span>` : ""}</p>`;
}

/** Pessoas em duas colunas, com as iniciais num selo de contorno dourado. */
function blocoPessoas(pessoas: { nome: string; papel?: string }[]): string {
  const celula = (p: { nome: string; papel?: string } | undefined) =>
    p
      ? `<td class="bp-col" width="50%" valign="top" style="width:50%;padding:0 8px 14px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="32" height="32" align="center" valign="middle" bgcolor="${COR.creme}" style="width:32px;height:32px;border:1px solid ${COR.ouro};border-radius:17px;background-color:${COR.creme};font-family:${SANS};font-size:11px;line-height:32px;font-weight:700;letter-spacing:0.5px;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(iniciais(p.nome))}</td>
<td valign="middle" style="padding:0 0 0 12px;font-family:${SANS};font-size:14px;line-height:19px;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(p.nome)}${p.papel ? `<br/><span style="font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.5px;color:${COR.ouroTexto};">${esc(caixaAlta(p.papel))}</span>` : ""}</td>
</tr></table>
</td>`
      : `<td class="bp-col" width="50%" style="width:50%;">&nbsp;</td>`;
  const linhas: string[] = [];
  for (let i = 0; i < pessoas.length; i += 2) {
    linhas.push(`<tr>${celula(pessoas[i])}${celula(pessoas[i + 1])}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${linhas.join("")}</table>`;
}

const AVISO_CONFIDENCIAL =
  "Esta mensagem pode conter informações confidenciais e é destinada apenas às pessoas indicadas. Se você a recebeu por engano, avise quem a enviou e apague-a.";

function moldura(o: {
  tipo: string;
  titulo: string;
  meta?: string | null;
  preheader: string;
  imagens: ImagensEmail;
  corpo: string;
}): string {
  const faixa = (src: string, altura: number) =>
    `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${esc(src)}" width="600" height="${altura}" alt="BISMARCHI | PIRES · Sociedade de Advogados" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:2px;color:${COR.tinta};" /></td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(o.titulo)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
@media (max-width: 560px) {
  .bp-px { padding-left: 24px !important; padding-right: 24px !important; }
  .bp-h1 { font-size: 25px !important; line-height: 32px !important; }
  .bp-col { display: block !important; width: 100% !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${COR.fundo};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COR.fundo};">${esc(o.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};">
<tr><td align="center" style="padding:32px 12px;">
<table role="article" aria-label="${esc(o.tipo)}" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${COR.borda};">
${faixa(o.imagens.cabecalho, 130)}
<tr><td class="bp-px" style="padding:38px 40px 0;">
<p style="margin:0 0 12px;font-family:${SANS};font-size:11px;line-height:14px;font-weight:700;letter-spacing:3px;color:${COR.ouroTexto};mso-line-height-rule:exactly;">${esc(caixaAlta(o.tipo))}</p>
<h1 class="bp-h1" style="margin:0;font-family:${SERIF};font-size:30px;line-height:38px;font-weight:normal;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(o.titulo)}</h1>
${o.meta ? `<p style="margin:10px 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${COR.suave};mso-line-height-rule:exactly;">${esc(o.meta)}</p>` : ""}
</td></tr>
<tr><td class="bp-px" style="padding:32px 40px 40px;">
${o.corpo}
</td></tr>
<tr><td class="bp-px" style="padding:0 40px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:18px 0 0;border-top:1px solid ${COR.borda};font-family:${SANS};font-size:11px;line-height:17px;color:${COR.suave};mso-line-height-rule:exactly;">${AVISO_CONFIDENCIAL}</td></tr></table>
</td></tr>
${faixa(o.imagens.rodape, 96)}
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Convite da reunião (corpo do evento no Outlook) ────────────────────────

export type DadosConvite = {
  titulo: string;
  cliente?: string | null;
  /** ISO (UTC ou com fuso). */
  inicio?: string | null;
  fim?: string | null;
  local?: string | null;
  /** Reunião com link do Teams (o Outlook acrescenta o link ao fim do corpo). */
  online?: boolean;
  participantes?: string[];
  organizador?: string | null;
  pauta: PautaReuniao;
  imagens: ImagensEmail;
};

export function emailConviteHtml(d: DadosConvite): string {
  const titulo = d.titulo.trim() || "Reunião";
  const inicio = dataValida(d.inicio);
  const fim = dataValida(d.fim);

  // Quando / onde / cliente, ao lado da folhinha.
  const infos: string[] = [];
  if (inicio) {
    infos.push(
      linhaInfo(
        "Quando",
        dataComSemana(inicio),
        `${hora(inicio)}${fim ? ` às ${hora(fim)}` : ""} · Horário de Brasília (UTC−3)`
      )
    );
  }
  const local = d.local?.trim();
  if (local || d.online) {
    infos.push(
      linhaInfo(
        "Onde",
        local || "Microsoft Teams",
        d.online
          ? local
            ? "Também pelo Microsoft Teams: o link está no fim deste convite."
            : "O link para entrar está no fim deste convite."
          : null
      )
    );
  }

  const cabecalho = inicio
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="100" valign="top" style="width:100px;padding:2px 0 0;">${blocoData(inicio)}</td>
<td valign="top">${infos.join("\n")}</td>
</tr></table>`
    : infos.join("\n");

  // Quem participa: organização primeiro, sem repetir o nome.
  const organizador = d.organizador?.trim();
  const vistos = new Set<string>();
  const pessoas: { nome: string; papel?: string }[] = [];
  if (organizador) {
    vistos.add(organizador.toLowerCase());
    pessoas.push({ nome: organizador, papel: "Organização" });
  }
  for (const nome of d.participantes ?? []) {
    const limpo = nome.trim();
    if (!limpo || vistos.has(limpo.toLowerCase())) continue;
    vistos.add(limpo.toLowerCase());
    pessoas.push({ nome: limpo });
  }

  // Pauta.
  const objetivo = d.pauta.objetivo.trim();
  const pendencias = d.pauta.pendencias.trim();
  const assuntos = d.pauta.assuntos.filter((a) => a.titulo.trim() || a.descricao.trim());
  const pauta: string[] = [];
  if (objetivo) {
    pauta.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr>
<td bgcolor="${COR.creme}" style="background-color:${COR.creme};border-left:3px solid ${COR.ouro};padding:18px 22px 4px;">
${rotulo("Objetivo", COR.ouroTexto, "0 0 8px")}
${textoParaHtmlEmail(objetivo, { tamanho: 16, cor: COR.tinta, espaco: 14 })}
</td></tr></table>`);
  }
  if (assuntos.length) {
    const itens = assuntos
      .map((a, i) => {
        const ultimo = i === assuntos.length - 1;
        const borda = `border-top:1px solid ${COR.linha};${ultimo ? `border-bottom:1px solid ${COR.linha};` : ""}`;
        const descricao = a.descricao.trim()
          ? `<div style="margin:6px 0 0;">${textoParaHtmlEmail(a.descricao, { tamanho: 14, cor: COR.suave, espaco: 6 })}</div>`
          : "";
        return `<tr>
<td width="48" valign="top" style="width:48px;padding:15px 0 14px;${borda}font-family:${SERIF};font-size:24px;line-height:26px;color:${COR.ouroEscuro};mso-line-height-rule:exactly;">${String(i + 1).padStart(2, "0")}</td>
<td valign="top" style="padding:16px 0 12px;${borda}"><p style="margin:0;font-family:${SANS};font-size:16px;line-height:23px;font-weight:700;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(a.titulo.trim() || "Assunto")}</p>${descricao}</td>
</tr>`;
      })
      .join("");
    pauta.push(
      rotulo("Assuntos", COR.ouroTexto, "0 0 10px"),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">${itens}</table>`
    );
  }
  if (pendencias) {
    const itens = pendencias
      .split(/\r?\n/)
      .map((l) => l.replace(ITEM_LISTA, "$1").replace(ITEM_NUMERADO, "$2").trim())
      .filter(Boolean)
      .map(
        (item) => `<tr>
<td width="28" valign="top" style="width:28px;padding:5px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="10" height="10" style="width:10px;height:10px;border:2px solid ${COR.ouroEscuro};font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
<td valign="top" style="padding:0 0 10px;font-family:${SANS};font-size:15px;line-height:23px;color:${COR.texto};mso-line-height-rule:exactly;">${inline(item)}</td>
</tr>`
      )
      .join("");
    pauta.push(
      rotulo("Pendências e pontos para decisão", COR.ouroTexto, "0 0 12px"),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itens}</table>`
    );
  }

  const corpo = [
    cabecalho,
    pessoas.length ? `${secao("Participantes", 18)}${blocoPessoas(pessoas)}` : "",
    pauta.length ? `${secao("Pauta", pessoas.length ? 20 : 30)}${pauta.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return moldura({
    tipo: "Convite para reunião",
    titulo,
    meta: d.cliente?.trim() || null,
    preheader: inicio
      ? `${dataComSemana(inicio)}, ${hora(inicio)}${d.cliente ? ` · ${d.cliente}` : ""}`
      : titulo,
    imagens: d.imagens,
    corpo,
  });
}

// ─── Ata enviada ao cliente ─────────────────────────────────────────────────

export type DadosAta = {
  titulo: string;
  cliente?: string | null;
  /** Início da reunião, ISO. */
  inicio?: string | null;
  /** Quem envia: assina o e-mail. */
  remetente?: string | null;
  remetenteEmail?: string | null;
  ata: string;
  imagens: ImagensEmail;
};

export function emailAtaHtml(d: DadosAta): string {
  const titulo = d.titulo.trim() || "Reunião";
  const inicio = dataValida(d.inicio);
  const conteudo = d.ata.trim()
    ? textoParaHtmlEmail(d.ata)
    : `<p style="margin:0;font-family:${SANS};font-size:15px;line-height:24px;font-style:italic;color:${COR.suave};">A ata ainda está vazia.</p>`;

  const p = (texto: string, margem: string, cor: string = COR.texto) =>
    `<p style="margin:${margem};font-family:${SANS};font-size:15px;line-height:25px;color:${cor};mso-line-height-rule:exactly;">${texto}</p>`;

  const nome = d.remetente?.trim();
  const email = d.remetenteEmail?.trim();
  const assinatura = `${p("Ficamos à disposição para qualquer esclarecimento.", "34px 0 0")}
${p("Atenciosamente,", "18px 0 0", COR.suave)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr>
<td style="border-left:2px solid ${COR.ouro};padding:2px 0 2px 16px;">
${nome ? `<p style="margin:0;font-family:${SERIF};font-size:19px;line-height:25px;color:${COR.tinta};mso-line-height-rule:exactly;">${esc(nome)}</p>` : ""}
${rotulo("Bismarchi | Pires", COR.ouroTexto, nome ? "5px 0 0" : "0")}
${email ? `<p style="margin:6px 0 0;font-family:${SANS};font-size:13px;line-height:18px;mso-line-height-rule:exactly;"><a href="mailto:${esc(email)}" style="color:${COR.suave};text-decoration:none;">${esc(email)}</a></p>` : ""}
</td></tr></table>`;

  const meta = [
    inicio ? `${dataPorExtenso(inicio)}, ${hora(inicio)}` : null,
    d.cliente?.trim() || null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const corpo = [
    p("Prezados,", "0 0 14px"),
    p(
      esc(
        inicio
          ? `Segue a ata da reunião realizada em ${dataPorExtenso(inicio)}.`
          : "Segue a ata da reunião."
      ),
      "0 0 26px"
    ),
    FIO_OURO,
    conteudo,
    assinatura,
  ].join("\n");

  return moldura({
    tipo: "Ata de reunião",
    titulo,
    meta: meta || null,
    preheader: inicio
      ? `Ata da reunião de ${dataPorExtenso(inicio)}${d.cliente ? ` · ${d.cliente}` : ""}`
      : `Ata da reunião ${titulo}`,
    imagens: d.imagens,
    corpo,
  });
}
