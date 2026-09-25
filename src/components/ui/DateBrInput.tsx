"use client";

import { useEffect, useId, useState } from "react";
import { clsx } from "clsx";

function isoParaBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function brParaIso(br: string): string | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const dt = new Date(ano, mes - 1, dia);
  if (
    dt.getFullYear() !== ano ||
    dt.getMonth() !== mes - 1 ||
    dt.getDate() !== dia
  ) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function mascaraData(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function DateBrInput({
  label,
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState(() => isoParaBr(value));
  const [erroLocal, setErroLocal] = useState<string>();

  useEffect(() => {
    setTexto(isoParaBr(value));
    setErroLocal(undefined);
  }, [value]);

  function commit(br: string) {
    const iso = brParaIso(br);
    if (!br.trim()) {
      onChange("");
      setErroLocal(undefined);
      return;
    }
    if (!iso) {
      setErroLocal("Use DD/MM/AAAA");
      return;
    }
    setErroLocal(undefined);
    setTexto(isoParaBr(iso));
    onChange(iso);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        value={texto}
        onChange={(e) => {
          const next = mascaraData(e.target.value);
          setTexto(next);
          setErroLocal(undefined);
          const iso = brParaIso(next);
          if (iso) onChange(iso);
        }}
        onBlur={() => commit(texto)}
        className={clsx(
          "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          (error || erroLocal) &&
            "border-red-400 focus:border-red-500 focus:ring-red-500"
        )}
      />
      {(error || erroLocal) && (
        <span className="text-xs text-red-600">{error || erroLocal}</span>
      )}
    </div>
  );
}
