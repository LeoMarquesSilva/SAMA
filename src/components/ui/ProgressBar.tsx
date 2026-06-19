import { clsx } from "clsx";

export function ProgressBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  /** Texto acessível; se omitido, usa o percentual. */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `${clamped}% concluído`}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
        {clamped}%
      </span>
    </div>
  );
}
