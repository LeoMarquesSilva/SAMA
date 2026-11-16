"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { carregarTranscricaoReuniao } from "@/lib/reunioes/actions";
import type { ReuniaoTranscricao } from "@/types/database";

type Bloco = { speaker: string; start: number; texto: string };

/** Junta falas seguidas da mesma pessoa num bloco só. */
function agrupar(segmentos: ReuniaoTranscricao["segmentos"]): Bloco[] {
  const blocos: Bloco[] = [];
  for (const s of segmentos) {
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.speaker === s.speaker) {
      ultimo.texto += ` ${s.text}`;
    } else {
      blocos.push({ speaker: s.speaker, start: s.start, texto: s.text });
    }
  }
  return blocos;
}

function tempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function duracaoMin(t: ReuniaoTranscricao): number | null {
  if (t.gravacao_inicio && t.gravacao_fim) {
    const ms =
      new Date(t.gravacao_fim).getTime() - new Date(t.gravacao_inicio).getTime();
    if (ms > 0) return Math.round(ms / 60_000);
  }
  const fim = t.segmentos[t.segmentos.length - 1]?.end;
  return fim ? Math.round(fim / 60) : null;
}

/** Transcrição da gravação do Fellow, guardada no SAMA (abre e fecha dentro da ata). */
export function TranscricaoFellow({ reuniaoId }: { reuniaoId: string }) {
  const [estado, setEstado] = useState<"loading" | "ok" | "vazio" | "erro">(
    "loading"
  );
  const [transcricao, setTranscricao] = useState<ReuniaoTranscricao | null>(null);
  const [erro, setErro] = useState<string>();
  const [aberta, setAberta] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    setEstado("loading");
    setAberta(false);
    carregarTranscricaoReuniao(reuniaoId)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) {
          setErro(r.error);
          setEstado("erro");
          return;
        }
        setTranscricao(r.transcricao);
        setEstado(r.transcricao?.segmentos?.length ? "ok" : "vazio");
      })
      .catch(() => {
        if (!vivo) return;
        setErro("Erro ao carregar a transcrição.");
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [reuniaoId]);

  const blocos = useMemo(
    () => agrupar(transcricao?.segmentos ?? []),
    [transcricao]
  );
  const falantes = useMemo(
    () => Array.from(new Set(blocos.map((b) => b.speaker))),
    [blocos]
  );

  function copiar() {
    const texto = blocos
      .map((b) => `[${tempo(b.start)}] ${b.speaker}: ${b.texto}`)
      .join("\n\n");
    void navigator.clipboard
      ?.writeText(texto)
      .then(() => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => undefined);
  }

  const resumo =
    estado === "loading"
      ? "Buscando…"
      : estado === "vazio"
        ? "Sem gravação com falas no Fellow"
        : estado === "erro"
          ? erro
          : (() => {
              const min = transcricao ? duracaoMin(transcricao) : null;
              const partes = [`${transcricao?.segmentos.length ?? 0} falas`];
              if (min) partes.push(`${min} min`);
              return partes.join(" · ");
            })();

  const Seta = aberta ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        disabled={estado !== "ok"}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="flex items-center gap-2 font-medium text-slate-700">
          {estado === "ok" ? (
            <Seta size={15} className="text-slate-400" />
          ) : null}
          <MessageSquareText size={15} className="text-brand-600" />
          Transcrição (Fellow)
        </span>
        <span
          className={clsx(
            "flex items-center gap-1.5 text-xs",
            estado === "erro" ? "text-red-700" : "text-slate-500"
          )}
        >
          {estado === "loading" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : null}
          {resumo}
        </span>
      </button>

      {aberta && estado === "ok" ? (
        <div className="border-t border-slate-200">
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-500">
            <span className="min-w-0 truncate">{falantes.join(", ")}</span>
            <button
              type="button"
              onClick={copiar}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <ol className="max-h-96 space-y-3 overflow-y-auto px-3 pb-3 text-sm">
            {blocos.map((b, i) => (
              <li key={i}>
                <p className="text-xs font-semibold text-slate-600">
                  {b.speaker}{" "}
                  <span className="font-normal text-slate-400">
                    {tempo(b.start)}
                  </span>
                </p>
                <p className="leading-relaxed text-slate-700">{b.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
