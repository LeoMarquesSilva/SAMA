import { dayKeyInTz } from "@/lib/timezone";

export type ChecklistItem = {
  text: string;
  done: boolean;
  colaborador_id?: string | null;
  prazo?: string | null;
  responsavel_nome?: string | null;
  responsavel_email?: string | null;
  enviadoVios?: boolean;
  /** yyyy-MM-dd do envio ao VIOS (fuso SP). */
  enviadoViosEm?: string | null;
};

const ITEM_RE = /^-\s*\[( |x|X)\]\s*(.*)$/;
const META_RE = /\s\{bp:([^}|]*)(?:\|([^}|]*))?(?:\|([^}]*))?\}\s*$/;
const VIOS_META_RE = /^vios(?::(\d{4}-\d{2}-\d{2}))?$/i;

function parseViosMeta(raw: string): {
  enviadoVios: boolean;
  enviadoViosEm: string | null;
} {
  const m = raw.trim().match(VIOS_META_RE);
  if (!m) return { enviadoVios: false, enviadoViosEm: null };
  return { enviadoVios: true, enviadoViosEm: m[1] ?? null };
}

function stripMeta(raw: string): {
  text: string;
  colaborador_id: string | null;
  prazo: string | null;
  enviadoVios: boolean;
  enviadoViosEm: string | null;
} {
  const m = raw.match(META_RE);
  if (!m) {
    return {
      text: raw.trim(),
      colaborador_id: null,
      prazo: null,
      enviadoVios: false,
      enviadoViosEm: null,
    };
  }
  return {
    text: raw.slice(0, m.index).trim(),
    colaborador_id: m[1]?.trim() || null,
    prazo: m[2]?.trim() || null,
    ...parseViosMeta(m[3] ?? ""),
  };
}

export function parseChecklist(raw: string | null | undefined): ChecklistItem[] {
  if (!raw?.trim()) return [];

  const items: ChecklistItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const content = line.trimStart();
    const match = content.match(ITEM_RE);
    if (match) {
      const meta = stripMeta(match[2]);
      items.push({
        done: match[1].toLowerCase() === "x",
        ...meta,
      });
      continue;
    }

    if (content.startsWith("- ")) {
      items.push({ done: false, ...stripMeta(content.slice(2)) });
      continue;
    }

    items.push({ done: false, ...stripMeta(content.trimEnd()) });
  }

  return items;
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items
    .map((item) => {
      const temMeta =
        item.colaborador_id || item.prazo || item.enviadoVios;
      const vios =
        item.enviadoVios
          ? `|vios${item.enviadoViosEm ? `:${item.enviadoViosEm}` : ""}`
          : "";
      const meta = temMeta
        ? ` {bp:${item.colaborador_id ?? ""}|${item.prazo ?? ""}${vios}}`
        : "";
      return `- [${item.done ? "x" : " "}] ${item.text}${meta}`;
    })
    .join("\n");
}

export function marcarPassosEnviadosVios(
  raw: string | null | undefined,
  textos: string[],
  enviadoEm = dayKeyInTz(new Date())
): string {
  const marks = new Set(
    textos.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  return serializeChecklist(
    parseChecklist(raw).map((item) =>
      marks.has(item.text.trim().toLowerCase())
        ? {
            ...item,
            enviadoVios: true,
            enviadoViosEm: item.enviadoViosEm || enviadoEm,
          }
        : item
    )
  );
}

export function rotuloEnviadoAgendamento(
  item: Pick<ChecklistItem, "enviadoVios" | "enviadoViosEm">
): string | null {
  if (!item.enviadoVios) return null;
  const em = item.enviadoViosEm;
  if (!em) return "Enviado para agendamento";
  const [y, mo, d] = em.split("-");
  if (!y || !mo || !d) return "Enviado para agendamento";
  return `Enviado para agendamento em ${d}/${mo}/${y}`;
}

/** Remove linhas vazias antes de persistir no banco. */
export function compactChecklist(items: ChecklistItem[]): string {
  return serializeChecklist(
    items.filter((item) => item.text.trim().length > 0)
  );
}

export function checklistTemItens(raw: string | null | undefined): boolean {
  return parseChecklist(raw).some((item) => item.text.trim().length > 0);
}

export function contarProximosPassosPendentes(
  raw: string | null | undefined
): number {
  return parseChecklist(raw).filter(
    (item) => item.text.trim().length > 0 && !item.done
  ).length;
}

export function removerDoChecklist(
  atual: string,
  extra: string | null | undefined
): string {
  const remove = new Set(
    parseChecklist(extra)
      .map((i) => i.text.trim().toLowerCase())
      .filter(Boolean)
  );
  return serializeChecklist(
    parseChecklist(atual).filter(
      (i) => i.text.trim() && !remove.has(i.text.trim().toLowerCase())
    )
  );
}

export function mesclarChecklists(
  atual: string,
  extra: string | null | undefined
): string {
  const a = parseChecklist(atual).filter((i) => i.text.trim());
  const b = parseChecklist(extra).filter((i) => i.text.trim());
  const seen = new Set(a.map((i) => i.text.trim().toLowerCase()));
  for (const item of b) {
    if (!seen.has(item.text.trim().toLowerCase())) {
      a.push({
        ...item,
        done: false,
        enviadoVios: false,
        enviadoViosEm: null,
      });
    }
  }
  return serializeChecklist(a);
}
