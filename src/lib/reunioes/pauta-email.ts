"use server";

import { getPessoaAtual } from "@/lib/currentPessoa";
import { createClient } from "@/lib/supabase/server";
import { outlookConfigurado, sendMail } from "@/lib/graph";
import { datetimeLocalSpToIso } from "@/lib/datetime-br";
import { parsePauta, pautaTemConteudo, type PautaReuniao } from "@/lib/pauta";
import {
  assuntoAta,
  assuntoPauta,
  destinatariosAta,
  emailAtaHtml,
  emailConviteHtml,
  imagensInline,
  separarDestinatarios,
} from "@/lib/email/templates";
import { IMAGENS_INLINE } from "@/lib/email/imagens";

export type EnvioPautaResult = {
  ok: boolean;
  error?: string;
  /** Destinatários que receberam a pauta. */
  enviadosPara?: string[];
};

async function nomeCliente(clienteId: string | null | undefined): Promise<string | null> {
  if (!clienteId?.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pessoas")
    .select("nome, grupo_cliente")
    .eq("ci", clienteId.trim())
    .maybeSingle();
  return data?.grupo_cliente || data?.nome || null;
}

function inicioIso(valor: string | null | undefined): string | null {
  return valor?.trim() ? (datetimeLocalSpToIso(valor) ?? valor) : null;
}

function erroEnvio(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Falha ao enviar o e-mail.";
  return /403/.test(msg)
    ? `O Graph recusou o envio (${msg}). Confirme a permissão de aplicativo Mail.Send no registro do Azure.`
    : msg;
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
  const corpoHtml = emailConviteHtml({
    titulo,
    cliente: await nomeCliente(input.clienteId),
    inicio: inicioIso(input.dataHoraInicio),
    organizador: pessoa.nome,
    pauta,
    imagens: imagensInline(),
  });

  try {
    await sendMail({
      remetenteEmail: pessoa.email,
      assunto: assuntoPauta(titulo),
      corpoHtml,
      para,
      cc,
      anexosInline: IMAGENS_INLINE,
    });
  } catch (err) {
    return { ok: false, error: erroEnvio(err) };
  }

  return { ok: true, enviadosPara: [...para, ...cc] };
}

/** Nome do cliente e de quem envia, para a prévia da ata bater com o envio. */
export async function contextoEmailAta(
  clienteId?: string | null
): Promise<{
  cliente: string | null;
  remetente: string | null;
  remetenteEmail: string | null;
}> {
  const pessoa = await getPessoaAtual();
  return {
    cliente: await nomeCliente(clienteId),
    remetente: pessoa?.nome ?? null,
    remetenteEmail: pessoa?.email ?? null,
  };
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

  const { para, cc } = destinatariosAta(input.emails ?? []);
  if (para.length === 0) {
    return { ok: false, error: "Informe ao menos um e-mail para enviar a ata." };
  }

  const titulo = input.titulo?.trim() || "Reunião";
  const corpoHtml = emailAtaHtml({
    titulo,
    cliente: await nomeCliente(input.clienteId),
    inicio: inicioIso(input.dataHoraInicio),
    remetente: pessoa.nome,
    remetenteEmail: pessoa.email,
    ata,
    imagens: imagensInline(),
  });

  try {
    await sendMail({
      remetenteEmail: pessoa.email,
      assunto: assuntoAta(titulo),
      corpoHtml,
      para,
      cc,
      anexosInline: IMAGENS_INLINE,
    });
  } catch (err) {
    return { ok: false, error: erroEnvio(err) };
  }

  return { ok: true, enviadosPara: [...para, ...cc] };
}
