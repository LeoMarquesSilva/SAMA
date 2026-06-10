"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sincronizarCalendarioAutomatico } from "@/app/(app)/calendario/actions";

const STORAGE_KEY = "sama_cal_sync_at";
const COOLDOWN_MS = 30 * 60 * 1000;

/** Atualiza o calendário em background (throttle de 30 min por aba). */
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
