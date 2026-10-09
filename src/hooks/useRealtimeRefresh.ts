"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calendarioPageRefreshedRecently } from "@/lib/calendario";

export type RealtimeTable =
  | "outlook_eventos"
  | "reunioes"
  | "reuniao_participantes"
  | "atividades_internas"
  | "timesheet_entradas"
  | "usuarios"
  | "vios_tarefas";

/** Tabela assinada; `filter` segue o formato postgres_changes, ex.: `pessoa_id=eq.uuid`. */
export type RealtimeSubscription = { table: RealtimeTable; filter?: string };

type Options = {
  subscriptions: RealtimeSubscription[];
  enabled?: boolean;
};

/** Agrupa várias mudanças seguidas em um único refresh. */
const REALTIME_DEBOUNCE_MS = 4_000;
/** Evita refreshes em loop quando há muitos eventos realtime. */
const MIN_REFRESH_GAP_MS = 8_000;

/**
 * Assina postgres_changes e chama router.refresh() quando há alterações.
 * RLS do Supabase filtra o que o usuário pode receber.
 * Debounce + cooldown evitam recarregar a página inteira várias vezes seguidas
 * (ex.: após categorizar evento no calendário). Com a aba oculta o refresh fica
 * pendente e só roda quando o usuário volta para ela.
 */
export function useRealtimeRefresh({ subscriptions, enabled = true }: Options) {
  const router = useRouter();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAt = useRef(0);
  const pendingWhileHidden = useRef(false);

  // O array chega novo a cada render do layout (inclusive após router.refresh);
  // depender dele direto recriaria o canal a cada refresh.
  const subsKey = JSON.stringify(subscriptions);

  useEffect(() => {
    const subs = JSON.parse(subsKey) as RealtimeSubscription[];
    if (!enabled || subs.length === 0) return;

    const supabase = createClient();
    const channel = supabase.channel(
      `sama-realtime-${subs.map((s) => s.table).join("-")}`
    );

    const refreshNow = () => {
      if (calendarioPageRefreshedRecently()) return;
      const t = Date.now();
      if (t - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;
      if (document.hidden) {
        pendingWhileHidden.current = true;
        return;
      }
      lastRefreshAt.current = t;
      router.refresh();
    };

    const requestRefresh = () => {
      if (calendarioPageRefreshedRecently()) return;

      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(refreshNow, REALTIME_DEBOUNCE_MS);
    };

    const onVisibility = () => {
      if (document.hidden || !pendingWhileHidden.current) return;
      pendingWhileHidden.current = false;
      refreshNow();
    };
    document.addEventListener("visibilitychange", onVisibility);

    for (const { table, filter } of subs) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        requestRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [subsKey, enabled, router]);
}
