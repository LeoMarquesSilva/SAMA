import "server-only";

import { limparCorpoOutlook } from "@/lib/outlook";

// Credenciais do app no Azure (reaproveita o registro "Legis-app").
const TENANT = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID =
  process.env.MICROSOFT_CLIENT_ID ?? process.env.SHAREPOINT_CLIENT_ID!;
const CLIENT_SECRET =
  process.env.MICROSOFT_CLIENT_SECRET ?? process.env.SHAREPOINT_CLIENT_SECRET!;

const GRAPH = "https://graph.microsoft.com/v1.0";

let cache: { token: string; exp: number } | null = null;

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
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  location?: { displayName?: string } | null;
  organizer?: { emailAddress?: { name?: string; address?: string } } | null;
  attendees?: {
    emailAddress?: { name?: string; address?: string };
  }[];
};

// dateTime do Graph vem como "2026-06-10T13:00:00.0000000" (UTC, com Prefer).
function toIso(dt?: string): string | null {
  if (!dt) return null;
  const norm = dt.endsWith("Z") ? dt : `${dt}Z`;
  const d = new Date(norm);
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
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      cache: "no-store",
    });

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
      const inicio = toIso(e.start?.dateTime);
      const fim = toIso(e.end?.dateTime);
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
