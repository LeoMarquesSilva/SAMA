"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type RealtimeTable =
  | "outlook_eventos"
  | "reunioes"
  | "reuniao_participantes"
  | "atividades_internas"
  | "timesheet_entradas"
  | "usuarios";

type Options = {
  tables: RealtimeTable[];
  /** Filtro postgres_changes, ex.: `pessoa_id=eq.uuid` */
  filter?: string;
  enabled?: boolean;
};

/**
 * Assina postgres_changes e chama router.refresh() quando há alterações.
 * RLS do Supabase filtra o que o usuário pode receber.
 */
export function useRealtimeRefresh({
  tables,
  filter,
  enabled = true,
}: Options) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const supabase = createClient();
    const channel = supabase.channel(`sama-realtime-${tables.join("-")}`);

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          router.refresh();
        }
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tables, filter, enabled, router]);
}
