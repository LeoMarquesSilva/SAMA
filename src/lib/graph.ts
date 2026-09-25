import "server-only";

import { limparCorpoOutlook } from "@/lib/outlook";
import { SP_UTC_OFFSET } from "@/lib/datetime-br";

// Credenciais do app no Azure (reaproveita o registro "Legis-app").
const TENANT = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID =
  process.env.MICROSOFT_CLIENT_ID ?? process.env.SHAREPOINT_CLIENT_ID!;
const CLIENT_SECRET =
  process.env.MICROSOFT_CLIENT_SECRET ?? process.env.SHAREPOINT_CLIENT_SECRET!;

const GRAPH = "https://graph.microsoft.com/v1.0";
/** Evita hang infinito quando o Graph demora/504 em uma mailbox. */
const GRAPH_FETCH_TIMEOUT_MS = 30_000;

let cache: { token: string; exp: number } | null = null;

function graphSignal(ms = GRAPH_FETCH_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

export function outlookConfigurado(): boolean {
  return Boolean(TENANT && CLIENT_ID && CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  if (cache && cache.exp > Date.now() + 60_000) return cache.token;

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
      signal: graphSignal(15_000),
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao obter token do Graph: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = {
    token: data.access_token,
    exp: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export type GraphEvento = {
  outlookEventId: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  duracaoMinutos: number | null;
  local: string | null;
  online: boolean;
  linkOnline: string | null;
  organizadorNome: string | null;
  organizadorEmail: string | null;
  participantes: { nome: string; email: string }[];
  corpoPreview: string | null;
};

type GraphEventRaw = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl?: string } | null;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string } | null;
  organizer?: { emailAddress?: { name?: string; address?: string } } | null;
  attendees?: {
    emailAddress?: { name?: string; address?: string };
  }[];
};

const GRAPH_TZ_SP = "America/Sao_Paulo";

function normalizeGraphTimeZone(tz?: string | null): "UTC" | typeof GRAPH_TZ_SP {
  const t = tz?.trim();
  if (!t || t === "UTC" || t === "Etc/UTC" || t === "Etc/GMT") return "UTC";
  if (
    t === GRAPH_TZ_SP ||
    t === "E. South America Standard Time" ||
    t === "SA Eastern Standard Time"
  ) {
    return GRAPH_TZ_SP;
  }
  // App voltado ao escritório no Brasil — demais fusos tratados como SP.
  return GRAPH_TZ_SP;
}

/**
 * Converte start/end do Graph para ISO UTC.
 * Com Prefer outlook.timezone=America/Sao_Paulo, dateTime vem como hora local SP;
 * o Graph às vezes inclui "Z" indevidamente — respeitamos timeZone e ignoramos Z nesse caso.
 */
function graphDateTimeToIso(
  dateTime?: string,
  timeZone?: string | null
): string | null {
  if (!dateTime?.trim()) return null;

  const raw = dateTime.trim();
  const withoutFrac = raw.replace(/\.\d+/, "");
  const hasZ = /Z$/i.test(withoutFrac);
  const localPart = withoutFrac.replace(/Z$/i, "");
  const tz = normalizeGraphTimeZone(timeZone);

  if (tz === "UTC") {
    const iso = hasZ ? withoutFrac : `${localPart}Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(`${localPart}${SP_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Lê os eventos do calendário de um usuário (por e-mail) num intervalo.
 * Usa permissão de aplicativo Calendars.Read (app-only).
 */
export async function getCalendarEvents(
  email: string,
  startISO: string,
  endISO: string
): Promise<GraphEvento[]> {
  const token = await getToken();
  const params = new URLSearchParams({
    startDateTime: startISO,
    endDateTime: endISO,
    $select:
      "id,subject,bodyPreview,isCancelled,isOnlineMeeting,onlineMeeting,start,end,location,organizer,attendees",
    $orderby: "start/dateTime",
    $top: "100",
  });

  const eventos: GraphEvento[] = [];
  let url:
    | string
    | null = `${GRAPH}/users/${encodeURIComponent(email)}/calendarView?${params}`;

  while (url) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="America/Sao_Paulo"',
        },
        cache: "no-store",
        signal: graphSignal(),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new Error(
          `Graph timeout (${GRAPH_FETCH_TIMEOUT_MS / 1000}s) ao ler calendário de ${email}`
        );
      }
      throw err;
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Graph ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      value: GraphEventRaw[];
      "@odata.nextLink"?: string;
    };

    for (const e of data.value) {
      if (e.isCancelled) continue;
      const inicio = graphDateTimeToIso(
        e.start?.dateTime,
        e.start?.timeZone ?? GRAPH_TZ_SP
      );
      const fim = graphDateTimeToIso(
        e.end?.dateTime,
        e.end?.timeZone ?? GRAPH_TZ_SP
      );
      const dur =
        inicio && fim
          ? Math.round(
              (new Date(fim).getTime() - new Date(inicio).getTime()) / 60000
            )
          : null;

      eventos.push({
        outlookEventId: e.id,
        titulo: e.subject ?? "(sem título)",
        inicio,
        fim,
        duracaoMinutos: dur && dur > 0 ? dur : null,
        local: e.location?.displayName || null,
        online: Boolean(e.isOnlineMeeting),
        linkOnline: e.onlineMeeting?.joinUrl ?? null,
        organizadorNome: e.organizer?.emailAddress?.name ?? null,
        organizadorEmail: e.organizer?.emailAddress?.address ?? null,
        participantes: (e.attendees ?? [])
          .map((a) => ({
            nome: a.emailAddress?.name ?? "",
            email: a.emailAddress?.address ?? "",
          }))
          .filter((a) => a.email),
        corpoPreview: limparCorpoOutlook(e.bodyPreview),
      });
    }

    url = data["@odata.nextLink"] ?? null;
  }

  return eventos;
}

export type GraphAttendee = {
  email: string;
  nome?: string;
  tipo?: "required" | "optional" | "resource";
};

export type GraphEventInput = {
  organizerEmail: string;
  titulo: string;
  inicioLocal: string;
  fimLocal: string;
  bodyHtml?: string;
  attendees?: GraphAttendee[];
  location?: string | null;
  isOnlineMeeting?: boolean;
};

export type GraphEventCreated = {
  outlookEventId: string;
  joinUrl: string | null;
};

async function graphJson<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="America/Sao_Paulo"',
      ...(init.headers ?? {}),
    },
    cache: "no-store",
    signal: graphSignal(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Graph ${res.status}: ${txt.slice(0, 280)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function eventPayload(input: GraphEventInput) {
  return {
    subject: input.titulo,
    start: { dateTime: input.inicioLocal, timeZone: GRAPH_TZ_SP },
    end: { dateTime: input.fimLocal, timeZone: GRAPH_TZ_SP },
    body: input.bodyHtml
      ? { contentType: "HTML", content: input.bodyHtml }
      : undefined,
    location: input.location ? { displayName: input.location } : undefined,
    attendees: (input.attendees ?? []).map((a) => ({
      emailAddress: { address: a.email, name: a.nome },
      type: a.tipo ?? "required",
    })),
    isOnlineMeeting: Boolean(input.isOnlineMeeting),
    onlineMeetingProvider: input.isOnlineMeeting
      ? "teamsForBusiness"
      : undefined,
  };
}

export async function createCalendarEvent(
  input: GraphEventInput
): Promise<GraphEventCreated> {
  const data = await graphJson<{
    id: string;
    onlineMeeting?: { joinUrl?: string } | null;
  }>(`/users/${encodeURIComponent(input.organizerEmail)}/events`, {
    method: "POST",
    body: JSON.stringify(eventPayload(input)),
  });
  return {
    outlookEventId: data.id,
    joinUrl: data.onlineMeeting?.joinUrl ?? null,
  };
}

export async function updateCalendarEvent(
  organizerEmail: string,
  outlookEventId: string,
  input: Omit<GraphEventInput, "organizerEmail">
): Promise<GraphEventCreated> {
  const data = await graphJson<{
    id: string;
    onlineMeeting?: { joinUrl?: string } | null;
  }>(
    `/users/${encodeURIComponent(organizerEmail)}/events/${encodeURIComponent(outlookEventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(
        eventPayload({ ...input, organizerEmail })
      ),
    }
  );
  return {
    outlookEventId: data.id,
    joinUrl: data.onlineMeeting?.joinUrl ?? null,
  };
}

export async function cancelCalendarEvent(
  organizerEmail: string,
  outlookEventId: string,
  comment?: string
): Promise<void> {
  await graphJson(
    `/users/${encodeURIComponent(organizerEmail)}/events/${encodeURIComponent(outlookEventId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ comment: comment ?? "Cancelado pelo SAMA." }),
    }
  );
}

export type GraphScheduleSlot = {
  email: string;
  availabilityView: string;
  scheduleItems: {
    status: string;
    start: string | null;
    end: string | null;
    subject?: string;
  }[];
};

/** Livre/ocupado dos internos (e salas) no intervalo. Intervalo em minutos: 15 ou 30. */
export async function getSchedule(opts: {
  organizerEmail: string;
  emails: string[];
  startISO: string;
  endISO: string;
  intervalMinutes?: 15 | 30;
}): Promise<GraphScheduleSlot[]> {
  const data = await graphJson<{
    value: {
      scheduleId?: string;
      availabilityView?: string;
      scheduleItems?: {
        status?: string;
        subject?: string;
        start?: { dateTime?: string; timeZone?: string };
        end?: { dateTime?: string; timeZone?: string };
      }[];
    }[];
  }>(`/users/${encodeURIComponent(opts.organizerEmail)}/calendar/getSchedule`, {
    method: "POST",
    body: JSON.stringify({
      schedules: opts.emails,
      startTime: { dateTime: opts.startISO, timeZone: "UTC" },
      endTime: { dateTime: opts.endISO, timeZone: "UTC" },
      availabilityViewInterval: opts.intervalMinutes ?? 15,
    }),
  });

  return (data.value ?? []).map((row) => ({
    email: row.scheduleId ?? "",
    availabilityView: row.availabilityView ?? "",
    scheduleItems: (row.scheduleItems ?? []).map((item) => ({
      status: item.status ?? "busy",
      subject: item.subject,
      start: graphDateTimeToIso(
        item.start?.dateTime,
        item.start?.timeZone ?? "UTC"
      ),
      end: graphDateTimeToIso(item.end?.dateTime, item.end?.timeZone ?? "UTC"),
    })),
  }));
}

export async function findUsersByDisplayPrefix(
  prefix: string
): Promise<{ displayName: string; mail: string | null }[]> {
  const safe = prefix.replace(/'/g, "''");
  const data = await graphJson<{
    value?: { displayName?: string; mail?: string; userPrincipalName?: string }[];
  }>(
    `/users?$select=displayName,mail,userPrincipalName&$filter=startsWith(displayName,'${safe}')&$top=25`,
    { method: "GET" }
  );
  return (data.value ?? []).map((u) => ({
    displayName: u.displayName ?? "",
    mail: u.mail ?? u.userPrincipalName ?? null,
  }));
}
