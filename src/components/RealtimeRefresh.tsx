"use client";

import {
  useRealtimeRefresh,
  type RealtimeTable,
} from "@/hooks/useRealtimeRefresh";

export function RealtimeRefresh({
  tables,
  filter,
  enabled = true,
}: {
  tables: RealtimeTable[];
  filter?: string;
  enabled?: boolean;
}) {
  useRealtimeRefresh({ tables, filter, enabled });
  return null;
}
