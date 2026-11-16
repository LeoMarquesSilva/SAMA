import "server-only";

import type { FellowActionItemRaw } from "@/lib/fellow-assignees";

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

/** Uma fala da transcrição: start/end em segundos desde o início da gravação. */
export type FellowSegmento = {
  start: number;
  end: number;
  speaker: string;
  text: string;
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
  transcript?: {
    speech_segments?: FellowSegmento[] | null;
    language_code?: string | null;
  } | null;
};

export type FellowTranscricao = {
  recordingId: string;
  idioma: string | null;
  inicio: string | null;
  fim: string | null;
  segmentos: FellowSegmento[];
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
  actionItems: FellowActionItemRaw[];
  temResumoIa: boolean;
  temTopicosIa: boolean;
};

export type FellowBuscaResult =
  | { status: "ok"; conteudo: FellowConteudo }
  | { status: "sem_gravacao" }
  | { status: "sem_conteudo_ia"; tituloFellow: string | null };

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

type FellowInclude = { transcript: boolean; ai_notes: boolean };

async function listRecordings(
  filters: Record<string, string>,
  include: FellowInclude = { transcript: false, ai_notes: true }
): Promise<FellowRecording[]> {
  const data = await fellowPost<FellowListResponse>("/api/v1/recordings", {
    filters,
    include,
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

function isTopicsSection(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t === "topics" || t === "topics discussed" || t === "tópicos discutidos";
}

function formatTopicsDiscussed(content: FellowRecapSection["content"]): string {
  if (!Array.isArray(content)) return "";

  const blocks: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;

    if ("title" in item && "bullet_points" in item) {
      const topic = item as { title: string; bullet_points?: { text: string }[] };
      const heading = topic.title?.trim();
      const bullets = (topic.bullet_points ?? [])
        .map((bp) => bp.text?.trim())
        .filter(Boolean)
        .map((text) => `- ${text}`);

      if (!heading && !bullets.length) continue;
      if (heading) blocks.push(`**${heading}**`);
      blocks.push(...bullets);
      if (bullets.length) blocks.push("");
      continue;
    }

    if ("text" in item) {
      const text = (item as { text: string }).text?.trim();
      if (text) blocks.push(`- ${text}`);
    }
  }

  return blocks.join("\n").trim();
}

function combinarResumo(summary: string, topicos: string): string {
  const parts: string[] = [];
  if (summary.trim()) parts.push(summary.trim());
  if (topicos.trim()) {
    parts.push(`**Tópicos discutidos**\n\n${topicos.trim()}`);
  }
  return parts.join("\n\n");
}

function extrairActionItemsRaw(
  content: FellowRecapSection["content"]
): FellowActionItemRaw[] {
  if (!Array.isArray(content)) return [];

  const items: FellowActionItemRaw[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object" || !("text" in item)) continue;
    const action = item as FellowActionItem;
    const text = action.text?.trim();
    if (!text) continue;
    items.push({
      text,
      done: action.status === "Done",
      prazo: action.due_date?.trim() || null,
      assignees: (action.assignees ?? []).map((a) => ({
        full_name: a.full_name?.trim(),
        email: a.email?.trim(),
      })),
    });
  }
  return items;
}

function formatActionItems(content: FellowRecapSection["content"]): string {
  return extrairActionItemsRaw(content)
    .map((action) => {
      const assignees = action.assignees
        .map((a) => a.email?.trim() || a.full_name?.trim())
        .filter(Boolean)
        .join(", ");
      const extras = [assignees, action.prazo ? `prazo: ${action.prazo}` : ""]
        .filter(Boolean)
        .join(" · ");
      const label = extras ? `${action.text} (${extras})` : action.text;
      return `- [${action.done ? "x" : " "}] ${label}`;
    })
    .join("\n");
}

function extrairAiNotes(aiNotes: FellowRecap[] | null | undefined): {
  resumo: string;
  proximos_passos: string;
  actionItems: FellowActionItemRaw[];
  temResumoIa: boolean;
  temTopicosIa: boolean;
} {
  if (!aiNotes?.length) {
    return {
      resumo: "",
      proximos_passos: "",
      actionItems: [],
      temResumoIa: false,
      temTopicosIa: false,
    };
  }
  const recap = aiNotes.find((n) => n.is_active) ?? aiNotes[0];

  let summary = "";
  let topicos = "";
  let proximos_passos = "";
  let actionItems: FellowActionItemRaw[] = [];

  for (const s of recap.sections) {
    if (isSummarySection(s.title)) {
      const body = typeof s.content === "string" ? s.content.trim() : "";
      if (body) summary = body;
      continue;
    }

    if (isTopicsSection(s.title)) {
      topicos = formatTopicsDiscussed(s.content);
      continue;
    }

    if (isActionItemsSection(s.title)) {
      actionItems = extrairActionItemsRaw(s.content);
      proximos_passos = formatActionItems(s.content);
    }
  }

  return {
    resumo: combinarResumo(summary, topicos),
    proximos_passos,
    actionItems,
    temResumoIa: Boolean(summary.trim()),
    temTopicosIa: Boolean(topicos.trim()),
  };
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

type BuscaGravacaoInput = {
  outlook_event_id?: string | null;
  titulo?: string | null;
  data_hora_inicio?: string | null;
};

async function encontrarGravacao(
  input: BuscaGravacaoInput,
  include?: FellowInclude
): Promise<FellowRecording | null> {
  let recording: FellowRecording | null = null;

  if (input.outlook_event_id?.trim()) {
    const porEvento = await listRecordings(
      { event_guid: input.outlook_event_id.trim() },
      include
    );
    recording = pickClosest(porEvento, input.data_hora_inicio);
  }

  if (!recording && input.titulo?.trim() && input.data_hora_inicio) {
    const inicio = new Date(input.data_hora_inicio);
    if (!Number.isNaN(inicio.getTime())) {
      const antes = new Date(inicio);
      antes.setDate(antes.getDate() - 1);
      const depois = new Date(inicio);
      depois.setDate(depois.getDate() + 2);

      const porTitulo = await listRecordings(
        {
          title: input.titulo.trim().slice(0, 255),
          created_at_start: isoDateOnly(antes),
          created_at_end: isoDateOnly(depois),
        },
        include
      );
      recording = pickClosest(porTitulo, input.data_hora_inicio);
    }
  }

  return recording;
}

/** Gravação com início a mais de 6 h do horário da reunião é de outro encontro com o mesmo título. */
const TOLERANCIA_TRANSCRICAO_MS = 6 * 60 * 60 * 1000;

/**
 * Transcrição da gravação da reunião no Fellow. Null quando não há gravação,
 * quando ela ainda não tem falas ou quando a gravação achada pelo título é de
 * outro dia/horário (reuniões recorrentes com o mesmo nome).
 */
export async function buscarTranscricaoFellow(
  input: BuscaGravacaoInput
): Promise<FellowTranscricao | null> {
  if (!fellowConfigurado()) return null;

  const recording = await encontrarGravacao(input, {
    transcript: true,
    ai_notes: false,
  });
  if (!recording) return null;

  if (input.data_hora_inicio && recording.started_at) {
    const diff = Math.abs(
      new Date(recording.started_at).getTime() -
        new Date(input.data_hora_inicio).getTime()
    );
    if (!Number.isNaN(diff) && diff > TOLERANCIA_TRANSCRICAO_MS) return null;
  }

  const segmentos = (recording.transcript?.speech_segments ?? []).filter(
    (s) => s && typeof s.text === "string" && s.text.trim()
  );
  if (!segmentos.length) return null;

  return {
    recordingId: recording.id,
    idioma: recording.transcript?.language_code ?? null,
    inicio: recording.started_at ?? null,
    fim: recording.ended_at ?? null,
    segmentos: segmentos.map((s) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      speaker: s.speaker?.trim() || "Sem identificação",
      text: s.text.trim(),
    })),
  };
}

export async function buscarGravacaoFellow(
  input: BuscaGravacaoInput
): Promise<FellowBuscaResult | null> {
  if (!fellowConfigurado()) return null;

  const recording = await encontrarGravacao(input);

  if (!recording) return { status: "sem_gravacao" };

  const { resumo, proximos_passos, actionItems, temResumoIa, temTopicosIa } =
    extrairAiNotes(recording.ai_notes);
  if (!resumo.trim() && !proximos_passos.trim() && !actionItems.length) {
    return { status: "sem_conteudo_ia", tituloFellow: recording.title };
  }

  return {
    status: "ok",
    conteudo: {
      recordingId: recording.id,
      tituloFellow: recording.title,
      resumo,
      proximos_passos,
      actionItems,
      temResumoIa,
      temTopicosIa,
    },
  };
}
