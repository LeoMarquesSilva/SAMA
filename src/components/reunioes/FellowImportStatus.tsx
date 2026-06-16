import { AlertCircle, CheckCircle2, Loader2, RefreshCw, SearchX } from "lucide-react";
import { clsx } from "clsx";
import {
  fellowHintNaoEncontrado,
  fellowHintSemGravacao,
  fellowHintSemIa,
  type FellowImportMotivo,
} from "@/lib/fellow-messages";

export type FellowImportStatus =
  | "idle"
  | "loading"
  | "success"
  | "not_found"
  | "error";

function notFoundHintText(motivo?: FellowImportMotivo): string {
  if (motivo === "sem_gravacao") return fellowHintSemGravacao();
  if (motivo === "sem_conteudo_ia") return fellowHintSemIa();
  return fellowHintNaoEncontrado();
}

export function fellowErroParaStatusImport(error?: string): "not_found" | "error" {
  const msg = (error ?? "").toLowerCase();
  if (
    msg.includes("nenhuma gravação") ||
    msg.includes("nenhum conteúdo fellow") ||
    msg.includes("não aparece como gravada") ||
    msg.includes("nao aparece como gravada") ||
    msg.includes("sem resumo ou ações") ||
    msg.includes("sem notas de ia") ||
    msg.includes("não encontrad") ||
    msg.includes("nao encontrad")
  ) {
    return "not_found";
  }
  return "error";
}

export function fellowMotivoParaStatusImport(
  motivo?: FellowImportMotivo | "config" | "api" | "parcial",
  error?: string
): Exclude<FellowImportStatus, "idle" | "loading" | "success"> {
  if (motivo === "sem_gravacao" || motivo === "sem_conteudo_ia") {
    return "not_found";
  }
  if (motivo === "config" || motivo === "api") {
    return "error";
  }
  return fellowErroParaStatusImport(error);
}

export function FellowImportStatusHint({
  status,
  detail,
  motivo,
}: {
  status: FellowImportStatus;
  detail?: string;
  motivo?: FellowImportMotivo;
}) {
  if (status === "idle") return null;

  const config = {
    loading: {
      Icon: Loader2,
      text: "Buscando no Fellow…",
      className: "text-slate-400",
      spin: true,
    },
    success: {
      Icon: CheckCircle2,
      text: "Importado do Fellow",
      className: "text-emerald-600",
      spin: false,
    },
    not_found: {
      Icon: SearchX,
      text: notFoundHintText(motivo),
      className: "text-orange-600",
      spin: false,
    },
    error: {
      Icon: AlertCircle,
      text: "Falha na importação",
      className: "text-red-600",
      spin: false,
    },
  } as const;

  const { Icon, text, className, spin } = config[status];

  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 text-xs font-normal",
        className
      )}
      title={detail}
    >
      <Icon size={13} className={spin ? "animate-spin" : undefined} />
      <span>{text}</span>
    </span>
  );
}

export function FellowImportLabelActions({
  status,
  detail,
  motivo,
  onRefresh,
  busy,
  showRefresh = false,
  reserveRefreshSpace = false,
}: {
  status: FellowImportStatus;
  detail?: string;
  motivo?: FellowImportMotivo;
  onRefresh?: () => void;
  busy?: boolean;
  showRefresh?: boolean;
  /** Mantém o hint alinhado quando a linha de cima tem o botão de busca. */
  reserveRefreshSpace?: boolean;
}) {
  if (status === "idle" && !showRefresh && !reserveRefreshSpace) return null;

  const refreshButtonClass =
    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium";

  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      {showRefresh && onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          className={clsx(
            refreshButtonClass,
            "text-slate-500 transition",
            "hover:bg-slate-100 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <RefreshCw size={12} className={busy ? "animate-spin" : undefined} />
          {busy ? "Buscando…" : "Buscar novamente"}
        </button>
      ) : reserveRefreshSpace ? (
        <span
          className={clsx(refreshButtonClass, "invisible pointer-events-none select-none")}
          aria-hidden
        >
          <RefreshCw size={12} />
          Buscar novamente
        </span>
      ) : null}
      <FellowImportStatusHint status={status} detail={detail} motivo={motivo} />
    </span>
  );
}
