"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Leva para o calendário, onde o tour aponta os controles reais do agendamento. */
export function AgendamentoTourEntrada({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    if (pathname === "/calendario" || pathname.startsWith("/calendario/")) return;
    router.push("/calendario");
  }, [enabled, pathname, router]);

  return null;
}
