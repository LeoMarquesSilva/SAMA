import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import type { CalendarioItem } from "@/lib/calendario-items";
import { contarProximosPassosPendentes } from "@/lib/proximos-passos-checklist";
import type { OutlookEventoComPessoa } from "@/types/database";

/** Avatar do sócio dono do calendário (pessoa_id do evento). */
export function CalendarioSocioAvatar({
  evento,
  size = 18,
  className,
}: {
  evento: CalendarioItem | OutlookEventoComPessoa;
  size?: number;
  className?: string;
}) {
  const pessoa = evento.pessoa;
  const pendentes =
    "itemKind" in evento && evento.itemKind === "reuniao"
      ? contarProximosPassosPendentes(evento.reuniao?.proximos_passos)
      : 0;

  if (!pessoa?.nome && pendentes === 0) return null;

  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-0.5", className)}>
      {pendentes > 0 && (
        <span
          className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-amber-400 px-0.5 text-[9px] font-bold tabular-nums leading-none text-amber-950 ring-1 ring-white/60"
          title={
            pendentes === 1
              ? "1 próximo passo pendente"
              : `${pendentes} próximos passos pendentes`
          }
        >
          {pendentes}
        </span>
      )}
      {pessoa?.nome ? (
        <Avatar
          nome={pessoa.nome}
          src={pessoa.avatar_url}
          size={size}
          className="shrink-0 ring-2 ring-white/60"
        />
      ) : null}
    </span>
  );
}
