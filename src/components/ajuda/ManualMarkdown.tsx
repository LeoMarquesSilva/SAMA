import type { ReactNode } from "react";
import Image from "next/image";
import { clsx } from "clsx";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] text-slate-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function ManualFigure({ alt, src }: { alt: string; src: string }) {
  return (
    <figure className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-slate-100 sm:aspect-[16/9]">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain object-top"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      </div>
      {alt ? (
        <figcaption className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          {alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l))
    .map((line) =>
      line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
    );
  if (rows.length === 0) return null;
  const [head, ...body] = rows;

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[280px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {head.map((cell, i) => (
              <th key={i} className="px-3 py-2 font-semibold">
                {renderInline(cell.replace(/\*\*/g, ""))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 align-top">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      nodes.push(
        <ManualFigure
          key={key++}
          alt={imageMatch[1]}
          src={imageMatch[2]}
        />
      );
      i += 1;
      continue;
    }

    const printMatch = line.match(/^\[PRINT:\s*(.+)\]$/);
    if (printMatch) {
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(
        <h4
          key={key++}
          className="mb-2 mt-6 text-base font-semibold text-slate-800"
        >
          {line.slice(4)}
        </h4>
      );
      i += 1;
      continue;
    }

    if (line.startsWith("#### ")) {
      nodes.push(
        <h5
          key={key++}
          className="mb-2 mt-4 text-sm font-semibold text-slate-800"
        >
          {line.slice(5)}
        </h5>
      );
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i += 1;
      }
      nodes.push(
        <blockquote
          key={key++}
          className="my-3 rounded-r-lg border-l-4 border-brand-400 bg-brand-50/60 px-4 py-3 text-sm text-slate-700"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} className={qi > 0 ? "mt-2" : undefined}>
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      nodes.push(<MarkdownTable key={key++} lines={tableLines} />);
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      nodes.push(
        <ul
          key={key++}
          className="my-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700"
        >
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i += 1;
      }
      nodes.push(
        <ol
          key={key++}
          className="my-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700"
        >
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === "```") {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "```") {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <pre
          key={key++}
          className="my-4 overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-100"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("> ") &&
      !lines[i].startsWith("|") &&
      !lines[i].startsWith("[PRINT:") &&
      !lines[i].startsWith("![") &&
      !/^\d+\.\s/.test(lines[i]) &&
      lines[i].trim() !== "```"
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    nodes.push(
      <p key={key++} className="my-3 text-sm leading-relaxed text-slate-700">
        {renderInline(paraLines.join(" "))}
      </p>
    );
  }

  return <>{nodes}</>;
}

export function ManualMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={clsx("manual-markdown", className)}>
      <MarkdownBlock text={content} />
    </div>
  );
}
