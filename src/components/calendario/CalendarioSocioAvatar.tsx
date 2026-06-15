import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import type { OutlookEventoComPessoa } from "@/types/database";

/** Avatar do sócio dono do calendário (pessoa_id do evento). */
export function CalendarioSocioAvatar({
  evento,
  size = 18,
  className,
}: {
  evento: OutlookEventoComPessoa;
  size?: number;
  className?: string;
}) {
  const pessoa = evento.pessoa;
  if (!pessoa?.nome) return null;

  return (
    <Avatar
      nome={pessoa.nome}
      src={pessoa.avatar_url}
      size={size}
      className={clsx("shrink-0 ring-2 ring-white/60", className)}
    />
  );
}
