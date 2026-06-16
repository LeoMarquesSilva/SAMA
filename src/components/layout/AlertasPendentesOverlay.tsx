"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { dismissAlertasLoginBanner } from "@/app/(app)/calendario/actions";
import { CALENDARIO_PATH } from "@/lib/calendario";
import { PROXIMOS_PASSOS_PATH } from "@/lib/proximos-passos";
import { Z } from "@/lib/zIndex";

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string | null | undefined): string {
  if (!nome?.trim()) return "bem-vindo(a)";
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function AlertasPendentesOverlay({
  showInitially,
  nome,
  naoCategorizados,
  passosPendentes,
}: {
  showInitially: boolean;
  nome: string | null;
  naoCategorizados: number;
  passosPendentes: number;
}) {
  const [visible, setVisible] = useState(
    showInitially && (naoCategorizados > 0 || passosPendentes > 0)
  );
  const [pending, startTransition] = useTransition();

  function handleDismiss() {
    setVisible(false);
    startTransition(async () => {
      await dismissAlertasLoginBanner();
    });
  }

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) handleDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, pending]);

  if (!visible) return null;

  const titulo = `${saudacao()}, ${primeiroNome(nome)} 😊`;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: Z.modal }}
    >
      <div className="absolute inset-0 bg-slate-900/45" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resumo-login-titulo"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ zIndex: Z.modal + 1 }}
      >
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
          <h2
            id="resumo-login-titulo"
            className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl"
          >
            {titulo}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-500 sm:text-base">
            Revise suas pendências para manter o calendário organizado e os
            próximos passos das reuniões em dia. Excelente dia!
          </p>
        </div>

        <div className="space-y-3 px-6 py-6 sm:px-10">
          {naoCategorizados > 0 && (
            <Link
              href={CALENDARIO_PATH}
              onClick={handleDismiss}
              className="block rounded-xl border border-rose-100 bg-rose-50 px-4 py-3.5 text-center text-sm text-rose-700 transition hover:bg-rose-100/80 sm:text-base"
            >
              <strong className="font-semibold">
                {naoCategorizados.toLocaleString("pt-BR")}
              </strong>{" "}
              {naoCategorizados === 1
                ? "evento não categorizado no calendário"
                : "eventos não categorizados no calendário"}
            </Link>
          )}
          {passosPendentes > 0 && (
            <Link
              href={PROXIMOS_PASSOS_PATH}
              onClick={handleDismiss}
              className="block rounded-xl border border-rose-100 bg-rose-50 px-4 py-3.5 text-center text-sm text-rose-700 transition hover:bg-rose-100/80 sm:text-base"
            >
              <strong className="font-semibold">
                {passosPendentes.toLocaleString("pt-BR")}
              </strong>{" "}
              {passosPendentes === 1
                ? "próximo passo pendente de reunião"
                : "próximos passos pendentes de reuniões"}
            </Link>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4 sm:px-10">
          <div className="flex justify-center">
            <Button
              type="button"
              className="min-w-[140px]"
              onClick={handleDismiss}
              disabled={pending}
            >
              OK, entendi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
