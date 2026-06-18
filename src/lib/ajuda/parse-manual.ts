import { injectManualPrintImages } from "./manual-print-slugs";

export const AJUDA_PATH = "/ajuda";

export type ManualSubsection = {
  id: string;
  title: string;
  body: string;
};

export type ManualSection = {
  id: string;
  title: string;
  preamble: string;
  subsections: ManualSubsection[];
};

export type ManualTocItem = {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  sectionId?: string;
  keywords: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type GlossaryItem = {
  term: string;
  meaning: string;
};

export type ManualAppContent = {
  intro: string;
  sections: ManualSection[];
  toc: ManualTocItem[];
  faq: FaqItem[];
  glossary: GlossaryItem[];
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Remove numeração "1. " ou "2.3 " do título para exibição. */
export function cleanManualTitle(raw: string): string {
  return raw
    .replace(/^[\d.]+\s*/, "")
    .replace(/^Sobre este guia$/i, "Sobre este guia")
    .trim();
}

function parseSubsections(
  body: string,
  sectionId: string
): { preamble: string; subsections: ManualSubsection[] } {
  const parts = body.split(/\n(?=### )/);
  const first = parts[0] ?? "";
  const preamble =
    first.trim() && !first.startsWith("###") ? first.trim() : "";

  const subsections = parts
    .filter((p) => p.startsWith("### "))
    .map((block) => {
      const [titleLine, ...rest] = block.split("\n");
      const rawTitle = titleLine.replace(/^### /, "").trim();
      const title = cleanManualTitle(rawTitle);
      const id = `${sectionId}-${slugify(title)}`;
      return {
        id,
        title,
        body: rest.join("\n").trim(),
      };
    });

  return { preamble, subsections };
}

export function buildManualToc(
  intro: string,
  sections: ManualSection[]
): ManualTocItem[] {
  const items: ManualTocItem[] = [];

  if (intro.trim()) {
    items.push({
      id: "intro",
      title: "Sobre este guia",
      level: 1,
      keywords: intro.slice(0, 500).toLowerCase(),
    });
  }

  for (const section of sections) {
    items.push({
      id: section.id,
      title: cleanManualTitle(section.title),
      level: 1,
      sectionId: section.id,
      keywords: `${section.title} ${section.preamble}`.toLowerCase(),
    });

    for (const sub of section.subsections) {
      items.push({
        id: sub.id,
        title: sub.title,
        level: 2,
        sectionId: section.id,
        keywords: `${sub.title} ${sub.body}`.slice(0, 800).toLowerCase(),
      });
    }
  }

  return items;
}

export function parseFaq(markdown: string): FaqItem[] {
  const match = markdown.match(
    /## 8\. Dúvidas frequentes\n\n([\s\S]*?)\n---\n\n## 9\./
  );
  if (!match?.[1]) return [];

  return match[1]
    .trim()
    .split(/\n\n(?=\*\*)/)
    .map((block) => {
      const m = block.match(/^\*\*(.+?)\*\*\s*\n([\s\S]*)/);
      if (!m) return null;
      return { question: m[1].trim(), answer: m[2].trim() };
    })
    .filter((item): item is FaqItem => Boolean(item));
}

export function parseGlossary(markdown: string): GlossaryItem[] {
  const match = markdown.match(/## 9\. Glossário\n\n([\s\S]*?)$/);
  if (!match?.[1]) return [];

  const rows = match[1]
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---"));

  return rows
    .map((line) => {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 2) return null;
      const term = cells[0].replace(/\*\*/g, "").trim();
      const meaning = cells[1].replace(/\*\*/g, "").trim();
      return { term, meaning };
    })
    .filter((item): item is GlossaryItem => Boolean(item));
}

export function parseManualForApp(markdown: string): ManualAppContent {
  const withImages = injectManualPrintImages(markdown);
  const main = withImages.split("## 8. Dúvidas frequentes")[0] ?? withImages;
  const introEnd = main.indexOf("## 1.");
  const intro =
    introEnd >= 0
      ? main
          .slice(0, introEnd)
          .replace(/^# Manual do SAMA[^\n]*\n\n/, "")
          .replace(/^---\n\n/, "")
          .trim()
      : "";

  const body = introEnd >= 0 ? main.slice(introEnd) : main;
  const sectionBlocks = body.split(/\n(?=## \d+\.)/).filter(Boolean);

  const sections = sectionBlocks.map((block) => {
    const [titleLine, ...rest] = block.split("\n");
    const title = titleLine.replace(/^## /, "").trim();
    const id = slugify(cleanManualTitle(title));
    const rawBody = rest.join("\n").trim();
    const { preamble, subsections } = parseSubsections(rawBody, id);
    return { id, title, preamble, subsections };
  });

  const toc = buildManualToc(intro, sections);

  return {
    intro,
    sections,
    toc,
    faq: parseFaq(markdown),
    glossary: parseGlossary(markdown),
  };
}
