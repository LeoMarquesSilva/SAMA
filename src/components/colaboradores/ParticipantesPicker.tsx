"use client";

import { useMemo, useState } from "react";
import { Search, X, Users, ChevronDown, Plus, UserPlus } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import type { ColaboradorOpt } from "@/lib/colaboradores";

export type ParticipanteExterno = { nome: string; email: string };

function normalizaExternos(
  lista: { nome?: string | null; email?: string | null }[]
): ParticipanteExterno[] {
  const vistos = new Set<string>();
  const out: ParticipanteExterno[] = [];
  for (const p of lista) {
    const nome = (p.nome ?? "").trim();
    const email = (p.email ?? "").trim();
    if (!nome && !email) continue;
    const chave = email ? email.toLowerCase() : `nome:${nome.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ nome: nome || email, email });
  }
  return out;
}

export function ParticipantesPicker({
  colaboradores,
  defaultSelected = [],
  defaultExternos = [],
  name = "participantes",
  externosName = "participantes_externos",
  error,
}: {
  colaboradores: ColaboradorOpt[];
  defaultSelected?: string[];
  defaultExternos?: { nome?: string | null; email?: string | null }[];
  name?: string;
  externosName?: string;
  error?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelected)
  );
  const [externos, setExternos] = useState<ParticipanteExterno[]>(() =>
    normalizaExternos(defaultExternos)
  );
  const [busca, setBusca] = useState("");
  const [dept, setDept] = useState("");
  const [open, setOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");

  // E-mails internos já selecionados (para não duplicar como externo).
  const emailsInternosSelecionados = useMemo(() => {
    const set = new Set<string>();
    for (const c of colaboradores) {
      if (selected.has(c.id) && c.email) set.add(c.email.trim().toLowerCase());
    }
    return set;
  }, [colaboradores, selected]);

  const departamentos = useMemo(() => {
    const set = new Set<string>();
    for (const c of colaboradores) {
      if (c.departamento) set.add(c.departamento);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradores]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return colaboradores.filter((c) => {
      if (dept && c.departamento !== dept) return false;
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.departamento?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [colaboradores, busca, dept]);

  const porDepartamento = useMemo(() => {
    const map = new Map<string, ColaboradorOpt[]>();
    for (const c of filtrados) {
      const d = c.departamento ?? "Sem departamento";
      const arr = map.get(d) ?? [];
      arr.push(c);
      map.set(d, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [filtrados]);

  const selecionados = useMemo(
    () => colaboradores.filter((c) => selected.has(c.id)),
    [colaboradores, selected]
  );

  const totalSelecionado = selected.size + externos.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function addExterno() {
    const nome = novoNome.trim();
    const email = novoEmail.trim();
    if (!nome && !email) return;
    setExternos((prev) =>
      normalizaExternos([...prev, { nome: nome || email, email }])
    );
    setNovoNome("");
    setNovoEmail("");
  }

  function removeExterno(idx: number) {
    setExternos((prev) => prev.filter((_, i) => i !== idx));
  }

  // Externos visíveis: oculta os que já estão como colaborador interno selecionado.
  const externosVisiveis = useMemo(
    () =>
      externos
        .map((e, idx) => ({ ...e, idx }))
        .filter(
          (e) =>
            !(e.email && emailsInternosSelecionados.has(e.email.toLowerCase()))
        ),
    [externos, emailsInternosSelecionados]
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">
        Participantes <span className="text-red-500">*</span>
      </span>

      {/* Chips selecionados (internos + externos) */}
      {(selecionados.length > 0 || externosVisiveis.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {selecionados.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-1 pr-2 text-xs text-brand-800"
            >
              <Avatar nome={c.nome} src={c.avatar_url} size={20} />
              <span className="max-w-[140px] truncate">{c.nome}</span>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="rounded-full p-0.5 hover:bg-brand-100"
                aria-label={`Remover ${c.nome}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {externosVisiveis.map((e) => (
            <span
              key={`ext-${e.idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-2 text-xs text-slate-700"
              title={e.email || e.nome}
            >
              <Avatar nome={e.nome} size={20} />
              <span className="max-w-[160px] truncate">{e.nome}</span>
              <span className="rounded-full bg-slate-200 px-1 text-[9px] font-semibold uppercase text-slate-500">
                externo
              </span>
              <button
                type="button"
                onClick={() => removeExterno(e.idx)}
                className="rounded-full p-0.5 hover:bg-slate-200"
                aria-label={`Remover ${e.nome}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hidden inputs para FormData */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <input
        type="hidden"
        name={externosName}
        value={JSON.stringify(externos)}
      />

      {/* Painel de busca / seleção */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-slate-600"
        >
          <span className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            {totalSelecionado === 0
              ? "Buscar e selecionar participantes..."
              : `${totalSelecionado} selecionado(s)`}
          </span>
          <ChevronDown
            size={16}
            className={clsx(
              "text-slate-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div className="border-t border-slate-100 p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, e-mail ou área..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                />
              </div>
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
              >
                <option value="">Todos os departamentos</option>
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 max-h-52 overflow-y-auto">
              {filtrados.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">
                  Nenhum colaborador encontrado.
                </p>
              )}
              {porDepartamento.map(([departamento, lista]) => (
                <div key={departamento} className="mb-3 last:mb-0">
                  {!dept && (
                    <p className="sticky top-0 bg-white px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {departamento}
                    </p>
                  )}
                  {lista.map((c) => {
                    const checked = selected.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className={clsx(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                          checked
                            ? "bg-brand-50 text-brand-900"
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <Avatar nome={c.nome} src={c.avatar_url} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {c.nome}
                          </span>
                          {c.departamento && (
                            <span className="block truncate text-xs text-slate-400">
                              {c.departamento}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Adicionar participante externo (fora da equipe) */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <UserPlus size={13} /> Adicionar participante externo
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExterno();
                    }
                  }}
                  placeholder="Nome"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                />
                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExterno();
                    }
                  }}
                  placeholder="E-mail (opcional)"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                />
                <button
                  type="button"
                  onClick={addExterno}
                  disabled={!novoNome.trim() && !novoEmail.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
                >
                  <Plus size={15} /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
