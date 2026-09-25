export const SALA_SOMENTE_ONLINE = "SOMENTE_ONLINE" as const;

export const SALAS_ESCRITORIO = {
  SALA_1: "Sala 1",
  SALA_2: "Sala 2",
  BIBLIOTECA: "Biblioteca",
  OUTBACK: "Outback",
} as const;

export type SalaEscritorioKey = keyof typeof SALAS_ESCRITORIO;
export type SalaReuniao = SalaEscritorioKey | typeof SALA_SOMENTE_ONLINE;

export const SALA_LABEL: Record<SalaReuniao, string> = {
  ...SALAS_ESCRITORIO,
  SOMENTE_ONLINE: "Somente online",
};

export function salaOptions(): { value: SalaReuniao; label: string }[] {
  return (Object.keys(SALA_LABEL) as SalaReuniao[]).map((k) => ({
    value: k,
    label: SALA_LABEL[k],
  }));
}

const ENV_MAILBOX: Record<SalaEscritorioKey, string> = {
  SALA_1: "SAMA_SALA_1_EMAIL",
  SALA_2: "SAMA_SALA_2_EMAIL",
  BIBLIOTECA: "SAMA_SALA_BIBLIOTECA_EMAIL",
  OUTBACK: "SAMA_SALA_OUTBACK_EMAIL",
};

const DEFAULT_MAILBOX: Record<SalaEscritorioKey, string> = {
  SALA_1: "SALA01@bpplaw.com.br",
  SALA_2: "SALA02@bpplaw.com.br",
  BIBLIOTECA: "BIBLIOTECA@bpplaw.com.br",
  OUTBACK: "OUTBACK@bpplaw.com.br",
};

export function mailboxDaSala(sala: string | null | undefined): string | null {
  if (!sala || sala === SALA_SOMENTE_ONLINE) return null;
  const key = ENV_MAILBOX[sala as SalaEscritorioKey];
  if (!key) return null;
  return process.env[key]?.trim() || DEFAULT_MAILBOX[sala as SalaEscritorioKey] || null;
}

const SALA_NOME_RE: Record<SalaEscritorioKey, RegExp> = {
  SALA_1: /\bsala\s*0?1\b/i,
  SALA_2: /\bsala\s*0?2\b/i,
  BIBLIOTECA: /biblioteca/i,
  OUTBACK: /outback/i,
};

export function salaNomeMatch(sala: string): RegExp | null {
  return SALA_NOME_RE[sala as SalaEscritorioKey] ?? null;
}

export function prefixosBuscaSala(sala: string): string[] {
  if (sala === "SALA_1" || sala === "SALA_2") return ["Sala"];
  if (sala === "BIBLIOTECA") return ["Biblioteca"];
  if (sala === "OUTBACK") return ["Outback"];
  return [];
}

export function isSalaPresencial(sala: string | null | undefined): boolean {
  return Boolean(sala && sala !== SALA_SOMENTE_ONLINE);
}
