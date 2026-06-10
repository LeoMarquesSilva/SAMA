import { clsx } from "clsx";

type Tone = "green" | "gray" | "amber" | "blue" | "red";

const tones: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-700",
  gray: "bg-slate-100 text-slate-600",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-brand-100 text-brand-700",
  red: "bg-red-100 text-red-700",
};

export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
