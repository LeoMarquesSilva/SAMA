function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

/** Markdown simples → HTML seguro para contenteditable. */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .split("\n")
    .map((line) => (line ? inlineMarkdownToHtml(line) : "<br>"))
    .join("<br>");
}

function inlineNodesToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeName === "STRONG" || node.nodeName === "B") {
    return `**${Array.from(node.childNodes).map(inlineNodesToMarkdown).join("")}**`;
  }
  if (node.nodeName === "EM" || node.nodeName === "I") {
    return `*${Array.from(node.childNodes).map(inlineNodesToMarkdown).join("")}*`;
  }
  if (node.nodeName === "BR") {
    return "\n";
  }
  return Array.from(node.childNodes).map(inlineNodesToMarkdown).join("");
}

/** HTML do contenteditable → markdown simples. */
export function htmlToMarkdown(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html.trim() || "";

  if (!root.childNodes.length) return "";

  const lines: string[] = [];
  let current = "";

  for (const child of root.childNodes) {
    if (child.nodeName === "BR") {
      lines.push(current);
      current = "";
      continue;
    }
    current += inlineNodesToMarkdown(child).replace(/\u00a0/g, " ");
  }
  lines.push(current);

  return lines.join("\n").replace(/\n+$/, "");
}

export function getCaretTextOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.endContainer)) return 0;

  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

export function setCaretTextOffset(container: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(true);

  let remaining = Math.max(0, offset);
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
    node = walker.nextNode() as Text | null;
  }

  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function normalizeEditorHtml(container: HTMLElement, markdown: string) {
  const html = markdownToHtml(markdown);
  const caret = getCaretTextOffset(container);
  container.innerHTML = html || "<br>";
  setCaretTextOffset(container, Math.min(caret, container.innerText.length));
}
