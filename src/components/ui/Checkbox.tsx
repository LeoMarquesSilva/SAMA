"use client";

import clsx from "clsx";
import { Check } from "lucide-react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Checkbox({ checked, onChange, disabled, className, ...rest }: Props) {
  return (
    <span className={clsx("relative inline-flex shrink-0", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={rest["aria-label"]}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-1",
          checked
            ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/30"
            : "border-slate-300 bg-white text-transparent peer-hover:border-brand-400",
          disabled && "opacity-50"
        )}
      >
        <Check size={13} strokeWidth={3} />
      </span>
    </span>
  );
}
