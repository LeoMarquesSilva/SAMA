import "server-only";

import type { createAdminClient } from "@/lib/supabase/server";
import { colaboradorIdPorEmail } from "@/lib/colaborador-email";
import { normalizeEscritorioEmail } from "@/lib/email-escritorio";

/**
 * O tipo da reunião é o mesmo na agenda de todos os internos do compromisso.
 * Cada pessoa continua com a própria reunião: demanda, ata e próximos passos
 * são de cada um.
 *
 * O Outlook dá um id diferente ao mesmo compromisso em cada caixa. As cópias
 * são reconhecidas pelo mesmo título e início, com o dono de uma agenda entre
 * os envolvidos (organizador ou convidados) da outra, ou com o mesmo organizador.
 */

type Admin = ReturnType<typeof createAdminClient>;

type EventoAgenda = {
  id: string;
  pessoa_id: string;
  outlook_event_id: string;
  titulo: string | null;
  inicio: string | null;
  fim: string | null;
  duracao_minutos: number | null;
  local: string | null;
  link_online: string | null;
  organizador_email: string | null;
  participantes: { nome?: string | null; email?: string | null }[] | null;
  status: string;
  reuniao_id: string | null;
};

type ReuniaoModelo = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  cliente_id: string | null;
  modalidade: string;
  duracao_minutos: number | null;
  link_online: string | null;
  local: string | null;
};

const EVENTO_SELECT =
  "id, pessoa_id, outlook_event_id, titulo, inicio, fim, duracao_minutos, local, link_online, organizador_email, participantes, status, reuniao_id";
const MODELO_SELECT =
  "id, titulo, tipo, status, cliente_id, modalidade, duracao_minutos, link_online, local";

function chaveEvento(e: Pick<EventoAgenda, "titulo" | "inicio">): string | null {
  const titulo = (e.titulo ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!titulo || !e.inicio) return null;
  return `${titulo}|${new Date(e.inicio).toISOString().slice(0, 16)}`;
}

function envolvidos(e: EventoAgenda): Set<string> {
  const out = new Set<string>();
  const add = (email: string | null | undefined) => {
    if (email?.trim()) out.add(normalizeEscritorioEmail(email));
  };
  add(e.organizador_email);
  for (const p of e.participantes ?? []) add(p.email);
  return out;
}

async function emailsDosDonos(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const { data } = await admin.from("usuarios").select("id, email").in("id", unicos);
  return new Map(
    (data ?? [])
      .filter((u) => u.email)
      .map((u) => [u.id as string, normalizeEscritorioEmail(u.email as string)])
  );
}

/** Pares (evento, cópia do mesmo compromisso na agenda de outra pessoa). */
async function copiasNasOutrasAgendas(
  admin: Admin,
  eventos: EventoAgenda[]
): Promise<{ pares: { evento: EventoAgenda; copia: EventoAgenda }[]; emailDono: Map<string, string> }> {
  const inicios = [...new Set(eventos.map((e) => e.inicio).filter(Boolean))] as string[];
  if (inicios.length === 0) return { pares: [], emailDono: new Map() };

  // Em lotes: a lista vai na URL da consulta.
  const candidatos: EventoAgenda[] = [];
  for (let i = 0; i < inicios.length; i += 100) {
    const { data } = await admin
      .from("outlook_eventos")
      .select(EVENTO_SELECT)
      .in("inicio", inicios.slice(i, i + 100));
    candidatos.push(...((data ?? []) as EventoAgenda[]));
  }
  const emailDono = await emailsDosDonos(admin, [
    ...eventos.map((e) => e.pessoa_id),
    ...candidatos.map((c) => c.pessoa_id),
  ]);

  const organizador = (e: EventoAgenda) =>
    e.organizador_email?.trim() ? normalizeEscritorioEmail(e.organizador_email) : null;

  const pares: { evento: EventoAgenda; copia: EventoAgenda }[] = [];
  for (const evento of eventos) {
    const chave = chaveEvento(evento);
    if (!chave) continue;
    const donoEvento = emailDono.get(evento.pessoa_id);
    const deEvento = envolvidos(evento);
    const orgEvento = organizador(evento);
    for (const copia of candidatos) {
      if (copia.pessoa_id === evento.pessoa_id || chaveEvento(copia) !== chave) continue;
      const donoCopia = emailDono.get(copia.pessoa_id);
      // Convite por lista de e-mail não traz o nome de cada um: aí vale o mesmo organizador.
      if (
        (donoCopia && deEvento.has(donoCopia)) ||
        (donoEvento && envolvidos(copia).has(donoEvento)) ||
        (orgEvento && orgEvento === organizador(copia))
      ) {
        pares.push({ evento, copia });
      }
    }
  }
  return { pares, emailDono };
}

/** Cria a reunião da pessoa a partir da cópia classificada por outra e vincula o evento. */
async function classificarCopia(
  admin: Admin,
  evento: EventoAgenda,
  modelo: ReuniaoModelo,
  emailDono: string | undefined
): Promise<void> {
  if (!evento.inicio) return;
  const passada = new Date(evento.inicio).getTime() < Date.now();
  const linha = {
    titulo: evento.titulo?.trim() || modelo.titulo,
    tipo: modelo.tipo,
    modalidade: modelo.modalidade,
    status: passada ? "REALIZADA" : "AGENDADA",
    data_hora_inicio: evento.inicio,
    data_hora_fim: evento.fim,
    duracao_minutos: evento.duracao_minutos ?? modelo.duracao_minutos,
    cliente_id: modelo.cliente_id,
    link_online: evento.link_online ?? modelo.link_online,
    local: evento.local ?? modelo.local,
    origem: "OUTLOOK",
    criado_por_id: evento.pessoa_id,
    outlook_event_id: evento.outlook_event_id,
  };

  let { data: nova, error } = await admin.from("reunioes").insert(linha).select("id").single();
  if (error?.code === "23505") {
    // O id do evento já está em outra reunião: grava sem ele (o vínculo é o evento).
    ({ data: nova, error } = await admin
      .from("reunioes")
      .insert({ ...linha, outlook_event_id: null })
      .select("id")
      .single());
  }
  if (error || !nova) {
    console.error("[tipo-compartilhado] criar reunião:", error?.message);
    return;
  }

  // Participantes iguais aos do modelo; o dono desta agenda é o organizador.
  const [{ data: partes }, donoColabId] = await Promise.all([
    admin
      .from("reuniao_participantes")
      .select("colaborador_id, nome, email")
      .eq("reuniao_id", modelo.id),
    emailDono ? colaboradorIdPorEmail(admin, emailDono) : Promise.resolve(null),
  ]);
  const internos = new Set(
    (partes ?? []).map((p) => p.colaborador_id as string | null).filter(Boolean) as string[]
  );
  if (donoColabId) internos.add(donoColabId);
  const linhasPartes = [
    ...[...internos].map((colaboradorId) => ({
      reuniao_id: nova.id,
      colaborador_id: colaboradorId,
      papel: colaboradorId === donoColabId ? "ORGANIZADOR" : "PARTICIPANTE",
    })),
    ...(partes ?? [])
      .filter((p) => !p.colaborador_id && (p.nome || p.email))
      .map((p) => ({
        reuniao_id: nova.id,
        colaborador_id: null,
        nome: p.nome || p.email,
        email: p.email || null,
        papel: "PARTICIPANTE",
      })),
  ];
  if (linhasPartes.length > 0) {
    await admin.from("reuniao_participantes").insert(linhasPartes);
  }

  const { data: vinculado } = await admin
    .from("outlook_eventos")
    .update({
      status: "CATEGORIZADO_REUNIAO",
      reuniao_id: nova.id,
      categorizado_em: new Date().toISOString(),
    })
    .eq("id", evento.id)
    .eq("status", "PENDENTE")
    .select("id");
  // A pessoa classificou o evento nesse meio-tempo: fica a classificação dela.
  if (!vinculado?.length) {
    await admin.from("reunioes").delete().eq("id", nova.id);
  }
}

/**
 * Depois de classificar (ou mudar o tipo de) uma reunião: as reuniões dos
 * outros internos no mesmo compromisso recebem o tipo. Com `classificarPendentes`,
 * quem ainda não tinha classificado passa a ter a reunião classificada, com o
 * mesmo tipo e cliente e a demanda em branco. Quem ignorou o evento fica como está.
 */
export async function compartilharTipoDaReuniao(
  admin: Admin,
  reuniaoId: string,
  opts: { classificarPendentes: boolean }
): Promise<void> {
  const { data: modelo } = await admin
    .from("reunioes")
    .select(MODELO_SELECT)
    .eq("id", reuniaoId)
    .maybeSingle<ReuniaoModelo>();
  if (!modelo || modelo.status === "CANCELADA") return;

  const { data: proprios } = await admin
    .from("outlook_eventos")
    .select(EVENTO_SELECT)
    .eq("reuniao_id", reuniaoId);
  if (!proprios?.length) return;

  const { pares, emailDono } = await copiasNasOutrasAgendas(admin, proprios as EventoAgenda[]);
  const outrasReunioes = new Set<string>();
  const pendentes = new Map<string, EventoAgenda>();
  for (const { copia } of pares) {
    if (copia.status === "CATEGORIZADO_REUNIAO" && copia.reuniao_id && copia.reuniao_id !== reuniaoId) {
      outrasReunioes.add(copia.reuniao_id);
    } else if (copia.status === "PENDENTE" && !copia.reuniao_id) {
      pendentes.set(copia.id, copia);
    }
  }

  if (outrasReunioes.size > 0) {
    await admin
      .from("reunioes")
      .update({ tipo: modelo.tipo })
      .in("id", [...outrasReunioes])
      .neq("tipo", modelo.tipo);
  }

  if (!opts.classificarPendentes) return;
  for (const copia of pendentes.values()) {
    await classificarCopia(admin, copia, modelo, emailDono.get(copia.pessoa_id));
  }
}

/**
 * Sync: compromisso que acabou de chegar na agenda da pessoa e que outro
 * interno já classificou entra classificado, com o mesmo tipo e cliente.
 */
export async function classificarNovosPelasCopias(
  admin: Admin,
  pessoaId: string,
  outlookEventIds: string[]
): Promise<void> {
  if (outlookEventIds.length === 0) return;
  // Os ids do Graph são longos demais para irem todos na URL: filtra aqui.
  const ids = new Set(outlookEventIds);
  const { data: pendentes } = await admin
    .from("outlook_eventos")
    .select(EVENTO_SELECT)
    .eq("pessoa_id", pessoaId)
    .eq("status", "PENDENTE")
    .is("reuniao_id", null);
  const novos = ((pendentes ?? []) as EventoAgenda[]).filter((e) => ids.has(e.outlook_event_id));
  if (novos.length === 0) return;

  const { pares, emailDono } = await copiasNasOutrasAgendas(admin, novos as EventoAgenda[]);
  const modeloPorEvento = new Map<string, string>();
  for (const { evento, copia } of pares) {
    if (copia.status === "CATEGORIZADO_REUNIAO" && copia.reuniao_id && !modeloPorEvento.has(evento.id)) {
      modeloPorEvento.set(evento.id, copia.reuniao_id);
    }
  }
  if (modeloPorEvento.size === 0) return;

  const { data: modelos } = await admin
    .from("reunioes")
    .select(MODELO_SELECT)
    .in("id", [...new Set(modeloPorEvento.values())]);
  const modeloPorId = new Map(((modelos ?? []) as ReuniaoModelo[]).map((m) => [m.id, m]));

  for (const evento of novos as EventoAgenda[]) {
    const modelo = modeloPorId.get(modeloPorEvento.get(evento.id) ?? "");
    if (!modelo || modelo.status === "CANCELADA") continue;
    await classificarCopia(admin, evento, modelo, emailDono.get(evento.pessoa_id));
  }
}
