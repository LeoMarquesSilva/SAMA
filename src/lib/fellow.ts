import "server-only";

type FellowActionItem = {
  text: string;
  status?: string;
  assignees?: { full_name?: string; email?: string }[];
  due_date?: string | null;
};

type FellowRecapSection = {
  title: string;
  type: string;
  content:
    | string
    | FellowActionItem[]
    | { text: string; timestamp?: number }[]
    | { title: string; bullet_points?: { text: string }[] }[];
};

type FellowRecap = {
  id: string;
  is_active: boolean;
  title: string;
  sections: FellowRecapSection[];
};

export type FellowRecording = {
  id: string;
  title: string | null;
  event_guid: string | null;
  started_at: string;
  ended_at: string | null;
  media_url: string | null;
  note_id: string | null;
  ai_notes?: FellowRecap[] | null;
};

type FellowListResponse = {
  recordings: {
    data: FellowRecording[];
    page_info: { cursor: string | null; page_size: number };
  };
};

export type FellowConteudo = {
  recordingId: string;
  tituloFellow: string | null;
  resumo: string;
  proximos_passos: string;
  temResumoIa: boolean;
};

export class FellowApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FellowApiError";
    this.status = status;
  }
}

function apiBase(): string | undefined {
  return process.env.FELLOW_API_URL?.trim().replace(/\/$/, "");
}

function apiKey(): string | undefined {
  return process.env.FELLOW_API_KEY?.trim();
}

export function fellowConfigurado(): boolean {
  return Boolean(apiBase() && apiKey());
}

async function fellowPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const base = apiBase();
  const key = apiKey();
  if (!base || !key) {
    throw new FellowApiError(0, "Integração Fellow não configurada.");
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new FellowApiError(
      res.status,
      txt.startsWith("<!") ? "Fellow indisponível." : txt.slice(0, 240)
    );
  }

  return res.json() as Promise<T>;
}

async function listRecordings(
  filters: Record<string, string>
): Promise<FellowRecording[]> {
  const data = await fellowPost<FellowListResponse>("/api/v1/recordings", {
    filters,
    include: { transcript: false, ai_notes: true },
    pagination: { page_size: 10 },
  });
  return data.recordings?.data ?? [];
}

function isSummarySection(title: string): boolean {
  return title.trim().toLowerCase() === "summary";
}

function isActionItemsSection(title: string): boolean {
  return title.trim().toLowerCase() === "action items";
}

function formatActionItems(content: FellowRecapSection["content"]): string {
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object" || !("text" in item)) return "";
      const action = item as FellowActionItem;
      const text = action.text?.trim();
      if (!text) return "";

      const done = action.status === "Done";
      const assignees = (action.assignees ?? [])
        .map((a) => a.full_name?.trim())
        .filter(Boolean)
        .join(", ");
      const due = action.due_date?.trim();
      const extras = [assignees, due ? `prazo: ${due}` : ""]
        .filter(Boolean)
        .join(" · ");
      const label = extras ? `${text} (${extras})` : text;
      return `- [${done ? "x" : " "}] ${label}`;
    })
    .filter(Boolean)
    .join("\n");
}

function extrairAiNotes(aiNotes: FellowRecap[] | null | undefined): {
  resumo: string;
  proximos_passos: string;
} {
  if (!aiNotes?.length) return { resumo: "", proximos_passos: "" };
  const recap = aiNotes.find((n) => n.is_active) ?? aiNotes[0];

  let resumo = "";
  let proximos_passos = "";

  for (const s of recap.sections) {
    if (isSummarySection(s.title)) {
      const body = typeof s.content === "string" ? s.content.trim() : "";
      if (body) resumo = body;
      continue;
    }

    if (isActionItemsSection(s.title)) {
      proximos_passos = formatActionItems(s.content);
    }
  }

  return { resumo, proximos_passos };
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pickClosest(
  recordings: FellowRecording[],
  dataHoraInicio?: string | null
): FellowRecording | null {
  if (!recordings.length) return null;
  if (!dataHoraInicio) return recordings[0];

  const alvo = new Date(dataHoraInicio).getTime();
  if (Number.isNaN(alvo)) return recordings[0];

  return recordings.reduce((best, cur) => {
    const bestDiff = Math.abs(new Date(best.started_at).getTime() - alvo);
    const curDiff = Math.abs(new Date(cur.started_at).getTime() - alvo);
    return curDiff < bestDiff ? cur : best;
  });
}

export async function buscarGravacaoFellow(input: {
  outlook_event_id?: string | null;
  titulo?: string | null;
  data_hora_inicio?: string | null;
}): Promise<FellowConteudo | null> {
  if (!fellowConfigurado()) return null;

  let recording: FellowRecording | null = null;

  if (input.outlook_event_id?.trim()) {
    const porEvento = await listRecordings({
      event_guid: input.outlook_event_id.trim(),
    });
    recording = pickClosest(porEvento, input.data_hora_inicio);
  }

  if (!recording && input.titulo?.trim() && input.data_hora_inicio) {
    const inicio = new Date(input.data_hora_inicio);
    if (!Number.isNaN(inicio.getTime())) {
      const antes = new Date(inicio);
      antes.setDate(antes.getDate() - 1);
      const depois = new Date(inicio);
      depois.setDate(depois.getDate() + 2);

      const porTitulo = await listRecordings({
        title: input.titulo.trim().slice(0, 255),
        created_at_start: isoDateOnly(antes),
        created_at_end: isoDateOnly(depois),
      });
      recording = pickClosest(porTitulo, input.data_hora_inicio);
    }
  }

  if (!recording) return null;

  const { resumo, proximos_passos } = extrairAiNotes(recording.ai_notes);
  if (!resumo.trim() && !proximos_passos.trim()) return null;

  return {
    recordingId: recording.id,
    tituloFellow: recording.title,
    resumo,
    proximos_passos,
    temResumoIa: Boolean(resumo.trim()),
  };
}
