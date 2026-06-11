"use client";

import { Info } from "lucide-react";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info
        size={14}
        className="cursor-help text-slate-400"
        aria-label={text}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden w-72 -translate-y-1/2 rounded-lg bg-slate-800 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
