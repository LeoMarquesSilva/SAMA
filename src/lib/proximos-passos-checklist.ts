export type ChecklistItem = {
  text: string;
  done: boolean;
};

const ITEM_RE =
  /^-\s*\[( |x|X)\]\s*(.+)$/;

export function parseChecklist(raw: string | null | undefined): ChecklistItem[] {
  if (!raw?.trim()) return [];

  const items: ChecklistItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(ITEM_RE);
    if (match) {
      items.push({ done: match[1].toLowerCase() === "x", text: match[2].trim() });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      items.push({ done: false, text: trimmed.slice(2).trim() });
      continue;
    }

    items.push({ done: false, text: trimmed });
  }

  return items;
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items
    .map((item) => {
      const text = item.text.trim();
      if (!text) return "";
      return `- [${item.done ? "x" : " "}] ${text}`;
    })
    .filter(Boolean)
    .join("\n");
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
