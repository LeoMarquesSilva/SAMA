import "server-only";

import type { createAdminClient } from "@/lib/supabase/server";
import { normalizeEscritorioEmail } from "@/lib/email-escritorio";

/**
 * A demanda da reunião é a mesma na agenda de todos os internos do compromisso.
 * O tipo, a ata e os próximos passos continuam de cada um.
 *
 * O Outlook dá um id diferente ao mesmo compromisso em cada caixa. As cópias
 * são reconhecidas pelo mesmo título e início, com o dono de uma agenda entre
 * os envolvidos (organizador ou convidados) da outra, ou com o mesmo organizador.
 */

type Admin = ReturnType<typeof createAdminClient>;

type EventoAgenda = {
  id: string;
  pessoa_id: string;
  titulo: string | null;
  inicio: string | null;
  organizador_email: string | null;
  participantes: { nome?: string | null; email?: string | null }[] | null;
  status: string;
  reuniao_id: string | null;
};

const EVENTO_SELECT =
  "id, pessoa_id, titulo, inicio, organizador_email, participantes, status, reuniao_id";

function chaveEvento(e: Pick<EventoAgenda, "titulo" | "inicio">): string | null {
  const titulo = (e.titulo ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!titulo || !e.inicio) return null;
  return `${titulo}|${new Date(e.inicio).toISOString().slice(0, 16)}`;
}

function emailNormalizado(email: string | null | undefined): string | null {
  return email?.trim() ? normalizeEscritorioEmail(email) : null;
}

function envolvidos(e: EventoAgenda): Set<string> {
  const out = new Set<string>();
  for (const email of [e.organizador_email, ...(e.participantes ?? []).map((p) => p.email)]) {
    const n = emailNormalizado(email);
    if (n) out.add(n);
  }
  return out;
}

/** Reuniões que os outros internos já registraram para o mesmo compromisso. */
async function reunioesDosColegas(admin: Admin, reuniaoId: string): Promise<string[]> {
  const { data: proprios } = await admin
    .from("outlook_eventos")
    .select(EVENTO_SELECT)
    .eq("reuniao_id", reuniaoId);
  const eventos = (proprios ?? []) as EventoAgenda[];
  const inicios = [...new Set(eventos.map((e) => e.inicio).filter(Boolean))] as string[];
  if (inicios.length === 0) return [];

  const { data } = await admin
    .from("outlook_eventos")
    .select(EVENTO_SELECT)
    .in("inicio", inicios)
    .eq("status", "CATEGORIZADO_REUNIAO")
    .not("reuniao_id", "is", null)
    .neq("reuniao_id", reuniaoId);
  const candidatos = (data ?? []) as EventoAgenda[];
  if (candidatos.length === 0) return [];

  const ids = [...new Set([...eventos, ...candidatos].map((e) => e.pessoa_id))];
  const { data: donos } = await admin.from("usuarios").select("id, email").in("id", ids);
  const emailDono = new Map(
    (donos ?? []).map((u) => [u.id as string, emailNormalizado(u.email as string | null)])
  );

  const reunioes = new Set<string>();
  for (const evento of eventos) {
    const chave = chaveEvento(evento);
    if (!chave) continue;
    const donoEvento = emailDono.get(evento.pessoa_id);
    const deEvento = envolvidos(evento);
    const orgEvento = emailNormalizado(evento.organizador_email);
    for (const c of candidatos) {
      if (c.pessoa_id === evento.pessoa_id || chaveEvento(c) !== chave) continue;
      const donoCopia = emailDono.get(c.pessoa_id);
      // Convite por lista de e-mail não traz o nome de cada um: aí vale o mesmo organizador.
      if (
        (donoCopia && deEvento.has(donoCopia)) ||
        (donoEvento && envolvidos(c).has(donoEvento)) ||
        (orgEvento && orgEvento === emailNormalizado(c.organizador_email))
      ) {
        reunioes.add(c.reuniao_id as string);
      }
    }
  }
  return [...reunioes];
}

/**
 * Ao classificar sem demanda, a reunião recebe a que os colegas já escolheram.
 * Com demanda escolhida (ao classificar ou ao mudar depois), as reuniões dos
 * colegas recebem a mesma.
 */
export async function compartilharDemandaDaReuniao(
  admin: Admin,
  reuniaoId: string,
  opts: { aoClassificar: boolean }
): Promise<void> {
  const { data: reuniao } = await admin
    .from("reunioes")
    .select("demanda")
    .eq("id", reuniaoId)
    .maybeSingle();
  if (!reuniao) return;

  const colegas = await reunioesDosColegas(admin, reuniaoId);
  if (colegas.length === 0) return;

  if (opts.aoClassificar && !reuniao.demanda) {
    const { data: escolhida } = await admin
      .from("reunioes")
      .select("demanda")
      .in("id", colegas)
      .not("demanda", "is", null)
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (escolhida?.demanda) {
      await admin.from("reunioes").update({ demanda: escolhida.demanda }).eq("id", reuniaoId);
    }
    return;
  }

  await admin.from("reunioes").update({ demanda: reuniao.demanda }).in("id", colegas);
}
