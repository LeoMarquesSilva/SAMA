"use client";

import { Modal } from "@/components/ui/Modal";
import type { OutlookEventoComPessoa } from "@/types/database";
import type { ReactNode } from "react";

/** Bottom sheet / modal para detalhes do evento no modo calendário. */
export function CalendarioEventSheet({
  evento,
  onClose,
  children,
}: {
  evento: OutlookEventoComPessoa | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open={Boolean(evento)}
      onClose={onClose}
      title={evento?.titulo ?? "Evento"}
      size="lg"
    >
      {evento && children}
    </Modal>
  );
}
