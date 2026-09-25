"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { reuniaoSchema } from "@/lib/validations";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  findUsersByDisplayPrefix,
  getSchedule,
  outlookConfigurado,
  updateCalendarEvent,
  type GraphAttendee,
  type GraphScheduleSlot,
} from "@/lib/graph";
import { parsePauta, pautaParaHtmlConvite } from "@/lib/pauta";
import {
  mailboxDaSala,
  isSalaPresencial,
  SALA_LABEL,
  prefixosBuscaSala,
  salaNomeMatch,
} from "@/lib/salas";
import { formatDateTime } from "@/lib/format";
import { datetimeLocalSpToIso } from "@/lib/datetime-br";
import { createReuniao, updateReuniao, type ActionResult } from "@/lib/reunioes/actions";
import {
  marcarPassosEnviadosVios,
  parseChecklist,
} from "@/lib/proximos-passos-checklist";
import { revalidatePath } from "next/cache";
import { CALENDARIO_PATH } from "@/lib/calendario";
import type { ViosPassoEnvio } from "@/lib/vios-agendamento";
import {
  enviarCasosAgendamento,
  type CasoAgendamentoVios,
} from "@/lib/vios-entrada";
import { enfileirarCasosVios } from "@/lib/vios-fila";

async function resolverMailboxSala(
  sala: string | null | undefined
): Promise<string | null> {
  const fromEnv = mailboxDaSala(sala);
  if (fromEnv) return fromEnv;
  if (!sala || !isSalaPresencial(sala)) return null;

  const match = salaNomeMatch(sala);
  if (!match) return null;

  for (const prefix of prefixosBuscaSala(sala)) {
    try {
      const users = await findUsersByDisplayPrefix(prefix);
      const hit = users.find((u) => match.test(u.displayName) && u.mail);
      if (hit?.mail) return hit.mail;
    } catch {
      /* User.Read.All pode não estar no app */
    }
  }
  return null;
}

async function emailDoUsuario(usuarioId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("email")
    .eq("id", usuarioId)
    .maybeSingle();
  return data?.email ?? null;
}

async function montarAttendees(values: {
  participantes: string[];
  participantes_externos: { nome: string; email?: string }[];
  emails_cliente?: string[];
  sala?: string;
}): Promise<GraphAttendee[]> {
  const supabase = await createClient();
  const attendees: GraphAttendee[] = [];

  if (values.participantes.length) {
    const { data: cols } = await supabase
      .from("colaboradores")
      .select("id, nome, email")
      .in("id", values.participantes);
    for (const c of cols ?? []) {
      if (c.email) attendees.push({ email: c.email, nome: c.nome });
    }
  }

  for (const ext of values.participantes_externos ?? []) {
    if (ext.email?.trim()) {
      attendees.push({ email: ext.email.trim(), nome: ext.nome });
    }
  }

  for (const email of values.emails_cliente ?? []) {
    if (email.trim()) attendees.push({ email: email.trim(), tipo: "optional" });
  }

  const room = await resolverMailboxSala(values.sala);
  if (room) {
    attendees.push({
      email: room,
      nome: values.sala ? SALA_LABEL[values.sala as keyof typeof SALA_LABEL] : "Sala",
      tipo: "resource",
    });
  }

  return attendees;
}

async function htmlPauta(
  values: {
    titulo: string;
    cliente_id: string;
    data_hora_inicio: string;
    participantes: string[];
    pauta?: unknown;
  },
  responsavelNome: string
): Promise<string> {
  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("pessoas")
    .select("nome, grupo_cliente")
    .eq("ci", values.cliente_id)
    .maybeSingle();

  const { data: cols } = values.participantes.length
    ? await supabase
        .from("colaboradores")
        .select("nome")
        .in("id", values.participantes)
    : { data: [] as { nome: string }[] };

  return pautaParaHtmlConvite({
    titulo: values.titulo,
    cliente: cliente?.grupo_cliente || cliente?.nome,
    dataHora: formatDateTime(datetimeLocalSpToIso(values.data_hora_inicio) ?? values.data_hora_inicio),
    participantes: (cols ?? []).map((c) => c.nome),
    responsavel: responsavelNome,
    pauta: parsePauta(values.pauta),
  });
}

async function upsertEventoSama(opts: {
  pessoaId: string;
  outlookEventId: string;
  reuniaoId: string;
  titulo: string;
  inicio: string;
  fim: string | null;
  local: string | null;
  online: boolean;
  linkOnline: string | null;
  organizadorNome: string;
  organizadorEmail: string;
}) {
  const admin = createAdminClient();
  await admin.from("outlook_eventos").upsert(
    {
      pessoa_id: opts.pessoaId,
      outlook_event_id: opts.outlookEventId,
      titulo: opts.titulo,
      inicio: opts.inicio,
      fim: opts.fim,
      local: opts.local,
      online: opts.online,
      link_online: opts.linkOnline,
      organizador_nome: opts.organizadorNome,
      organizador_email: opts.organizadorEmail,
      status: "CATEGORIZADO_REUNIAO",
      reuniao_id: opts.reuniaoId,
      categorizado_em: new Date().toISOString(),
    },
    { onConflict: "pessoa_id,outlook_event_id" }
  );
}

export async function agendarReuniaoViaB(values: unknown): Promise<ActionResult> {
  const parsed = reuniaoSchema.safeParse({
    ...(values as object),
    origem: "SAMA",
    status: (values as { status?: string })?.status || "AGENDADA",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const pessoa = await getPessoaAtual();
  if (!pessoa?.email) {
    return { ok: false, error: "Usuário sem e-mail para criar o convite." };
  }
  if (!outlookConfigurado()) {
    return { ok: false, error: "Microsoft Graph não configurado." };
  }

  const sala = parsed.data.sala;
  const roomMail = await resolverMailboxSala(sala);
  if (isSalaPresencial(sala) && !roomMail) {
    return {
      ok: false,
      error: `Mailbox da sala não configurada (${sala}). Defina SAMA_SALA_*_EMAIL no ambiente.`,
    };
  }

  const attendees = await montarAttendees({
    participantes: parsed.data.participantes ?? [],
    participantes_externos: parsed.data.participantes_externos ?? [],
    emails_cliente: parsed.data.emails_cliente,
    sala,
  });

  const bodyHtml = await htmlPauta(parsed.data, pessoa.nome);
  const localLabel = isSalaPresencial(sala)
    ? SALA_LABEL[sala as keyof typeof SALA_LABEL]
    : parsed.data.local || null;
  let created;
  try {
    created = await createCalendarEvent({
      organizerEmail: pessoa.email,
      titulo: parsed.data.titulo,
      inicioLocal: parsed.data.data_hora_inicio,
      fimLocal: parsed.data.data_hora_fim,
      bodyHtml,
      attendees,
      location: localLabel,
      isOnlineMeeting: true,
    });
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Falha ao criar evento no Outlook (verifique Calendars.ReadWrite).",
    };
  }

  const saved = await createReuniao({
    ...parsed.data,
    origem: "SAMA",
    link_online: created.joinUrl || parsed.data.link_online,
    local: localLabel ?? parsed.data.local,
  });
  if (!saved.ok || !saved.id) return saved;

  const admin = createAdminClient();
  await admin
    .from("reunioes")
    .update({
      outlook_event_id: created.outlookEventId,
      link_online: created.joinUrl || parsed.data.link_online || null,
      origem: "SAMA",
    })
    .eq("id", saved.id);

  const inicio = datetimeLocalSpToIso(parsed.data.data_hora_inicio)!;
  const fim = datetimeLocalSpToIso(parsed.data.data_hora_fim);
  await upsertEventoSama({
    pessoaId: pessoa.id,
    outlookEventId: created.outlookEventId,
    reuniaoId: saved.id,
    titulo: parsed.data.titulo,
    inicio,
    fim,
    local: localLabel,
    online: true,
    linkOnline: created.joinUrl,
    organizadorNome: pessoa.nome,
    organizadorEmail: pessoa.email,
  });

  return { ok: true, id: saved.id };
}

export async function sincronizarReuniaoNoOutlook(
  reuniaoId: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = reuniaoSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const updated = await updateReuniao(reuniaoId, parsed.data);
  if (!updated.ok) return updated;

  const supabase = await createClient();
  const { data: reuniao } = await supabase
    .from("reunioes")
    .select("outlook_event_id, origem, criado_por_id, status, motivo_cancelamento")
    .eq("id", reuniaoId)
    .maybeSingle();

  if (!reuniao?.outlook_event_id || reuniao.origem !== "SAMA") {
    return updated;
  }
  if (!outlookConfigurado()) return updated;

  const orgEmail = reuniao.criado_por_id
    ? await emailDoUsuario(reuniao.criado_por_id)
    : null;
  if (!orgEmail) return updated;

  try {
    if (parsed.data.status === "CANCELADA") {
      await cancelCalendarEvent(
        orgEmail,
        reuniao.outlook_event_id,
        parsed.data.motivo_cancelamento
      );
      return updated;
    }

    const pessoa = await getPessoaAtual();
    const attendees = await montarAttendees({
      participantes: parsed.data.participantes ?? [],
      participantes_externos: parsed.data.participantes_externos ?? [],
      emails_cliente: parsed.data.emails_cliente,
      sala: parsed.data.sala,
    });
    const bodyHtml = await htmlPauta(parsed.data, pessoa?.nome ?? "");
    const patched = await updateCalendarEvent(orgEmail, reuniao.outlook_event_id, {
      titulo: parsed.data.titulo,
      inicioLocal: parsed.data.data_hora_inicio,
      fimLocal: parsed.data.data_hora_fim,
      bodyHtml,
      attendees,
      location: parsed.data.local,
      isOnlineMeeting: true,
    });
    if (patched.joinUrl) {
      const admin = createAdminClient();
      await admin
        .from("reunioes")
        .update({ link_online: patched.joinUrl })
        .eq("id", reuniaoId);
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Salvo no SAMA, mas o Outlook falhou: ${err.message}`
          : "Salvo no SAMA, mas o Outlook falhou.",
    };
  }

  return updated;
}

export async function consultarAgendaLivre(opts: {
  emails: string[];
  startISO: string;
  endISO: string;
  intervalMinutes?: 15 | 30;
  sala?: string | null;
}): Promise<{
  ok: boolean;
  slots?: GraphScheduleSlot[];
  salaIncluida?: boolean;
  error?: string;
}> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.email) return { ok: false, error: "Não autenticado." };
  if (!outlookConfigurado()) {
    return { ok: false, error: "Microsoft Graph não configurado." };
  }
  try {
    const emails = [...opts.emails];
    const room = await resolverMailboxSala(opts.sala);
    if (room && !emails.includes(room)) emails.push(room);
    const slots = await getSchedule({
      organizerEmail: pessoa.email,
      emails,
      startISO: opts.startISO,
      endISO: opts.endISO,
      intervalMinutes: opts.intervalMinutes,
    });
    return { ok: true, slots, salaIncluida: Boolean(room) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao consultar agenda.",
    };
  }
}

const VIOS_LIMITE_TODOS = 20;

function dataFatalBr(valor: string | null | undefined): string {
  const iso = (valor ?? "").trim();
  const ymd = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const br = iso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!br) return "";
  return `${br[1].padStart(2, "0")}/${br[2].padStart(2, "0")}/${br[3]}`;
}

function casoDoPasso(passo: ViosPassoEnvio): CasoAgendamentoVios {
  const pasta =
    (passo.pastaTipo === "Atendimento" ? passo.pasta : passo.processo)?.trim() ??
    "";
  if (!pasta) {
    throw new Error("Informe a pasta para a app de agendamento.");
  }
  const tarefa = passo.tarefa?.trim() ?? "";
  if (!tarefa) throw new Error("Selecione a tarefa.");
  const data = dataFatalBr(passo.prazo);
  if (!data) {
    throw new Error("Informe a data de envio no formato DD/MM/AAAA.");
  }
  return {
    tipo: passo.tipo?.trim() || "Providências",
    tarefa,
    observacao: passo.text.trim(),
    data,
    pasta,
  };
}

export async function enviarReuniaoAoVios(
  reuniaoId: string,
  passosEnvio?: ViosPassoEnvio[]
): Promise<ActionResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa) return { ok: false, error: "Não autenticado." };

  const supabase = await createClient();
  const { data: reuniao } = await supabase
    .from("reunioes")
    .select(
      "id, titulo, data_hora_inicio, cliente_id, proximos_passos, sharepoint_item_id, criado_por_id, cliente:pessoas(ci, nome, grupo_cliente)"
    )
    .eq("id", reuniaoId)
    .maybeSingle();

  if (!reuniao) return { ok: false, error: "Reunião não encontrada." };

  const passos =
    passosEnvio?.filter((i) => i.text.trim()) ??
    parseChecklist(reuniao.proximos_passos).filter((i) => i.text.trim());
  if (passos.length > VIOS_LIMITE_TODOS) {
    return {
      ok: false,
      error: `No máximo ${VIOS_LIMITE_TODOS} próximos passos por envio.`,
    };
  }
  if (passos.length === 0) {
    return { ok: false, error: "Inclua ao menos um próximo passo antes de enviar." };
  }

  try {
    const casos = passos.map((passo) => casoDoPasso(passo as ViosPassoEnvio));
    // Padrão: fila no Supabase consumida pelo RPA (sama-rpa).
    // VIOS_AGENDAMENTO_MODO=local volta a usar a app local (POST /casos).
    const recebidos =
      process.env.VIOS_AGENDAMENTO_MODO === "local"
        ? await enviarCasosAgendamento(casos)
        : await enfileirarCasosVios(
            reuniaoId,
            pessoa.id,
            passos.map((passo, i) => {
              const p = passo as ViosPassoEnvio;
              if (!p.colaborador_id) {
                throw new Error(`Selecione o Responsável no passo ${i + 1}.`);
              }
              return {
                ...casos[i],
                pastaTipo: p.pastaTipo === "Atendimento" ? "Atendimento" : "Processo",
                colaboradorId: p.colaborador_id,
              };
            })
          );

    const proximosPassos = marcarPassosEnviadosVios(
      reuniao.proximos_passos,
      passos.map((p) => p.text)
    );
    const admin = createAdminClient();
    await admin
      .from("reunioes")
      .update({
        sharepoint_item_id: [
          reuniao.sharepoint_item_id,
          ...recebidos.map((i) => i.id),
        ]
          .filter(Boolean)
          .join(","),
        vios_envio_status: "enviado",
        vios_envio_erro: null,
        proximos_passos: proximosPassos,
      })
      .eq("id", reuniaoId);
    revalidatePath(CALENDARIO_PATH);

    return { ok: true, id: recebidos[0]?.id, proximosPassos };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Falha ao enviar ao agendamento VIOS.";
    const admin = createAdminClient();
    await admin
      .from("reunioes")
      .update({ vios_envio_status: "erro", vios_envio_erro: msg })
      .eq("id", reuniaoId);
    return { ok: false, error: msg };
  }
}
