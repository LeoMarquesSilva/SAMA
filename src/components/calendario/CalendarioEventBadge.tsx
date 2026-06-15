"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { OutlookEventoStatus } from "@/types/database";
import { statusCalendarColor } from "@/lib/calendario-events";

export function CalendarioEventBadge({
  status,
  children,
  size = "sm",
  className,
}: {
  status: OutlookEventoStatus;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const c = statusCalendarColor[status];
  return (
    <span
      className={clsx(
        "inline-flex max-w-full shrink-0 items-center rounded px-1 py-0.5 font-bold tabular-nums leading-none tracking-tight",
        c.timeBadge,
        size === "sm" ? "text-[9px]" : "text-[10px]",
        className
      )}
    >
      {children}
    </span>
  );
}
