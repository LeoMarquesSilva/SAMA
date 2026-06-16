import { Fragment, type ReactNode } from "react";

/** Converte **negrito** e *itálico* em nós React (texto puro, sem HTML bruto). */
export function parseFormattedInline(text: string, keyPrefix = ""): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[1] != null) {
      nodes.push(
        <strong key={`${keyPrefix}b${i}`}>{match[1]}</strong>
      );
    } else if (match[2] != null) {
      nodes.push(<em key={`${keyPrefix}i${i}`}>{match[2]}</em>);
    }
    last = match.index + match[0].length;
    i++;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length ? nodes : [text];
}

export function FormattedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split("\n");

  return (
    <span className={className}>
      {lines.map((line, lineIdx) => (
        <Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {parseFormattedInline(line, `l${lineIdx}-`)}
        </Fragment>
      ))}
    </span>
  );
}
