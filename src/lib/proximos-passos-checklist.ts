export type ChecklistItem = {
  text: string;
  done: boolean;
};

const ITEM_RE = /^-\s*\[( |x|X)\]\s*(.*)$/;

export function parseChecklist(raw: string | null | undefined): ChecklistItem[] {
  if (!raw?.trim()) return [];

  const items: ChecklistItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const content = line.trimStart();
    const match = content.match(ITEM_RE);
    if (match) {
      items.push({ done: match[1].toLowerCase() === "x", text: match[2] });
      continue;
    }

    if (content.startsWith("- ")) {
      items.push({ done: false, text: content.slice(2) });
      continue;
    }

    items.push({ done: false, text: content.trimEnd() });
  }

  return items;
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items
    .map((item) => `- [${item.done ? "x" : " "}] ${item.text}`)
    .join("\n");
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
