"use server";

import { getPessoaAtual } from "@/lib/currentPessoa";
import { createClient } from "@/lib/supabase/server";
import { outlookConfigurado, sendMail } from "@/lib/graph";
import { isEmailEscritorio } from "@/lib/email-escritorio";
import { formatDateTime } from "@/lib/format";
import { datetimeLocalSpToIso } from "@/lib/datetime-br";
import {
  parsePauta,
  pautaParaHtmlConvite,
  pautaTemConteudo,
  type PautaReuniao,
} from "@/lib/pauta";

export type EnvioPautaResult = {
  ok: boolean;
  error?: string;
  /** Destinatários que receberam a pauta. */
  enviadosPara?: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clientes primeiro; a equipe interna entra em cópia. */
function separarDestinatarios(emails: string[]) {
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

/**
 * Manda a pauta por e-mail para os contatos do cliente, pela caixa de quem
 * clicou. Funciona com a reunião ainda não salva: o conteúdo vem da tela.
 */
export async function enviarPautaParaCliente(input: {
  titulo: string;
  clienteId?: string | null;
  dataHoraInicio?: string | null;
  emails: string[];
  pauta: unknown;
}): Promise<EnvioPautaResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.email) return { ok: false, error: "Não autenticado." };
  if (!outlookConfigurado()) {
    return { ok: false, error: "Microsoft Graph não configurado no servidor." };
  }

  const pauta: PautaReuniao = parsePauta(input.pauta);
  if (!pautaTemConteudo(pauta)) {
    return {
      ok: false,
      error: "Preencha a pauta antes de enviar (objetivo, assuntos ou pendências).",
    };
  }

  const { para, cc } = separarDestinatarios(input.emails ?? []);
  if (para.length === 0) {
    return {
      ok: false,
      error:
        "Informe ao menos um e-mail do cliente em “E-mails do cliente” para enviar a pauta.",
    };
  }

  const titulo = input.titulo?.trim() || "Reunião";

  let cliente: string | null = null;
  if (input.clienteId?.trim()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("pessoas")
      .select("nome, grupo_cliente")
      .eq("ci", input.clienteId.trim())
      .maybeSingle();
    cliente = data?.grupo_cliente || data?.nome || null;
  }

  const iso = input.dataHoraInicio?.trim()
    ? (datetimeLocalSpToIso(input.dataHoraInicio) ?? input.dataHoraInicio)
    : null;

  const corpoHtml = pautaParaHtmlConvite({
    titulo,
    cliente,
    dataHora: iso ? formatDateTime(iso) : null,
    responsavel: pessoa.nome,
    pauta,
  });

  try {
    await sendMail({
      remetenteEmail: pessoa.email,
      assunto: `Pauta da reunião — ${titulo}`,
      corpoHtml,
      para,
      cc,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao enviar o e-mail.";
    return {
      ok: false,
      error: /403/.test(msg)
        ? `O Graph recusou o envio (${msg}). Confirme a permissão de aplicativo Mail.Send no registro do Azure.`
        : msg,
    };
  }

  return { ok: true, enviadosPara: [...para, ...cc] };
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Ata em markdown simples (negrito do Fellow) para o corpo do e-mail. */
function ataParaHtml(texto: string): string {
  const linhas = texto.split(/\n/).map((linha) => {
    const segura = escHtml(linha).replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );
    return segura || "&nbsp;";
  });
  return linhas.join("<br/>");
}

/**
 * Manda a ata (texto do Fellow, depois da reunião) para os e-mails do cliente.
 */
export async function enviarAtaParaCliente(input: {
  titulo: string;
  clienteId?: string | null;
  dataHoraInicio?: string | null;
  emails: string[];
  ata: string;
}): Promise<EnvioPautaResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.email) return { ok: false, error: "Não autenticado." };
  if (!outlookConfigurado()) {
    return { ok: false, error: "Microsoft Graph não configurado no servidor." };
  }

  const ata = input.ata?.trim() ?? "";
  if (!ata) {
    return { ok: false, error: "A ata ainda está vazia." };
  }

  const { para, cc } = separarDestinatarios(input.emails ?? []);
  if (para.length === 0) {
    return {
      ok: false,
      error:
        "Informe ao menos um e-mail do cliente em “E-mails do cliente” para enviar a ata.",
    };
  }

  const titulo = input.titulo?.trim() || "Reunião";
  let cliente: string | null = null;
  if (input.clienteId?.trim()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("pessoas")
      .select("nome, grupo_cliente")
      .eq("ci", input.clienteId.trim())
      .maybeSingle();
    cliente = data?.grupo_cliente || data?.nome || null;
  }
  const iso = input.dataHoraInicio?.trim()
    ? (datetimeLocalSpToIso(input.dataHoraInicio) ?? input.dataHoraInicio)
    : null;

  const corpoHtml = `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#1e293b">
<h2 style="margin:0 0 12px">Ata de reunião</h2>
<p><strong>Título:</strong> ${escHtml(titulo)}</p>
${cliente ? `<p><strong>Cliente:</strong> ${escHtml(cliente)}</p>` : ""}
${iso ? `<p><strong>Data/horário:</strong> ${escHtml(formatDateTime(iso))}</p>` : ""}
<hr/>
<div>${ataParaHtml(ata)}</div>
</div>`;

  try {
    await sendMail({
      remetenteEmail: pessoa.email,
      assunto: `Ata da reunião — ${titulo}`,
      corpoHtml,
      para,
      cc,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao enviar o e-mail.";
    return {
      ok: false,
      error: /403/.test(msg)
        ? `O Graph recusou o envio (${msg}). Confirme a permissão de aplicativo Mail.Send no registro do Azure.`
        : msg,
    };
  }

  return { ok: true, enviadosPara: [...para, ...cc] };
}
