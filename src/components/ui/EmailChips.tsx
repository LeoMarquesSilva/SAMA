"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailsDeTexto(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function EmailChips({
  label = "E-mails do cliente",
  value,
  onChange,
  placeholder = "Digite o e-mail e pressione Enter",
  error,
}: {
  label?: string;
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  const [rascunho, setRascunho] = useState("");
  const [erroLocal, setErroLocal] = useState<string>();

  function adicionar(raw: string) {
    const novos = emailsDeTexto(raw);
    if (novos.length === 0) return false;
    const invalidos = novos.filter((e) => !EMAIL_RE.test(e));
    if (invalidos.length) {
      setErroLocal("Informe um e-mail válido.");
      return false;
    }
    const set = new Set(value.map((e) => e.toLowerCase()));
    const extra = novos.filter((e) => !set.has(e));
    if (extra.length) onChange([...value, ...extra]);
    setRascunho("");
    setErroLocal(undefined);
    return true;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === " ") {
      if (!rascunho.trim()) return;
      e.preventDefault();
      adicionar(rascunho);
      return;
    }
    if (e.key === "Backspace" && !rascunho && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className={clsx(
          "flex min-h-[39px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500",
          error || erroLocal
            ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500"
            : "border-slate-300"
        )}
      >
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs text-brand-800"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((e) => e !== email))}
              className="rounded-full p-0.5 hover:bg-brand-100"
              aria-label={`Remover ${email}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="email"
          value={rascunho}
          onChange={(e) => {
            setRascunho(e.target.value);
            if (erroLocal) setErroLocal(undefined);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (rascunho.trim()) adicionar(rascunho);
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>
      {(error || erroLocal) && (
        <p className="text-xs text-red-600">{error || erroLocal}</p>
      )}
    </div>
  );
}
