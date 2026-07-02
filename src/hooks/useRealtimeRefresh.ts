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

type Options = {
  tables: RealtimeTable[];
  /** Filtro postgres_changes, ex.: `pessoa_id=eq.uuid` */
  filter?: string;
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
 * (ex.: após categorizar evento no calendário).
 */
export function useRealtimeRefresh({
  tables,
  filter,
  enabled = true,
}: Options) {
  const router = useRouter();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const supabase = createClient();
    const channel = supabase.channel(`sama-realtime-${tables.join("-")}`);

    const requestRefresh = () => {
      if (calendarioPageRefreshedRecently()) return;

      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (calendarioPageRefreshedRecently()) return;
        const t = Date.now();
        if (t - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;
        lastRefreshAt.current = t;
        router.refresh();
      }, REALTIME_DEBOUNCE_MS);
    };

    for (const table of tables) {
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
      void supabase.removeChannel(channel);
    };
  }, [tables, filter, enabled, router]);
}
