"use client";

import { Modal } from "@/components/ui/Modal";
import type { CalendarioItem } from "@/lib/calendario-items";
import type { ReactNode } from "react";

/** Bottom sheet / modal para detalhes do evento no modo calendário. */
export function CalendarioEventSheet({
  evento,
  onClose,
  children,
}: {
  evento: CalendarioItem | null;
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
