"use client";

import {
  useRealtimeRefresh,
  type RealtimeSubscription,
} from "@/hooks/useRealtimeRefresh";

export function RealtimeRefresh({
  subscriptions,
  enabled = true,
}: {
  subscriptions: RealtimeSubscription[];
  enabled?: boolean;
}) {
  useRealtimeRefresh({ subscriptions, enabled });
  return null;
}
