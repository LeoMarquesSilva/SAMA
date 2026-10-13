"use client";

import { createContext, useContext } from "react";

export type ReportarErroContexto = {
  /** Abre o "Reportar" com o print de `alvo` (um modal) ou, sem alvo, da página. */
  abrir: (alvo?: HTMLElement | null) => void;
  /** Confirmação do último chamado aberto, para o cabeçalho. */
  aviso: string | null;
};

export const ReportarErroCtx = createContext<ReportarErroContexto | null>(null);

/** Null fora do layout autenticado (ex.: login): aí não há "Reportar". */
export function useReportarErro() {
  return useContext(ReportarErroCtx);
}
