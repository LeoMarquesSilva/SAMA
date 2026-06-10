import { clsx } from "clsx";

function iniciais(nome: string): string {
  return (
    nome
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({
  nome,
  src,
  size = 36,
  className,
}: {
  nome: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={nome}
        title={nome}
        style={{ width: size, height: size }}
        className={clsx("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      title={nome}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700",
        className
      )}
    >
      {iniciais(nome)}
    </div>
  );
}

/** Avatar + nome, em linha. */
export function PersonTag({
  nome,
  src,
  size = 22,
  className,
}: {
  nome: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5", className)}>
      <Avatar nome={nome} src={src} size={size} />
      <span className="truncate">{nome}</span>
    </span>
  );
}

/** Pilha de avatares para grupos (participantes). */
export function AvatarGroup({
  pessoas,
  max = 4,
  size = 24,
}: {
  pessoas: { nome: string; avatar_url?: string | null }[];
  max?: number;
  size?: number;
}) {
  const shown = pessoas.slice(0, max);
  const rest = pessoas.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <Avatar
          key={i}
          nome={p.nome}
          src={p.avatar_url}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
          className="flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ring-2 ring-white"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
