"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { OutlookEventoStatus } from "@/types/database";
import type { CalendarioItemKind } from "@/lib/calendario-items";
import { calendarioItemColor } from "@/lib/calendario-events";

export function CalendarioEventBadge({
  status,
  itemKind,
  children,
  size = "sm",
  className,
}: {
  status: OutlookEventoStatus;
  itemKind?: CalendarioItemKind;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const c = calendarioItemColor({ status, itemKind });
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
