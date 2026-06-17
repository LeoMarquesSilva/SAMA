"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sincronizarCalendarioAutomatico } from "@/app/(app)/calendario/actions";

const STORAGE_KEY = "sama_cal_sync_at";
const COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Sincroniza o calendário do Outlook ao abrir a tela do calendário.
 * Montado na página /calendario: o efeito roda a cada vez que a tela é aberta,
 * com throttle de 5 min por aba para evitar chamadas repetidas ao Graph.
 */
export function CalendarioAutoSync() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (last && Date.now() - last < COOLDOWN_MS) return;

    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    void sincronizarCalendarioAutomatico().then(() => router.refresh());
  }, [router]);

  return null;
}
