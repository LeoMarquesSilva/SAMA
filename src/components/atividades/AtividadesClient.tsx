"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PersonTag } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { AtividadeForm } from "./AtividadeForm";
import { TIPO_ATIVIDADE_INTERNA, atividadeTipoOptions } from "@/lib/constants";
import { formatDateTime, formatDuration } from "@/lib/format";
import { deleteAtividade } from "@/app/(app)/atividades/actions";
import type { AtividadeComPessoa } from "@/types/database";

export function AtividadesClient({
  atividades,
  pessoas,
  podeEscolherPessoa,
  pessoaAtualId,
  autoNew = false,
}: {
  atividades: AtividadeComPessoa[];
  pessoas: { id: string; nome: string; avatar_url?: string | null }[];
  podeEscolherPessoa: boolean;
  pessoaAtualId: string | null;
  autoNew?: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AtividadeComPessoa | null>(null);
  const [fTipo, setFTipo] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (autoNew) {
      setEditing(null);
      setFormOpen(true);
    }
  }, [autoNew]);

  const filtradas = useMemo(
    () => atividades.filter((a) => !fTipo || a.tipo === fTipo),
    [atividades, fTipo]
  );

  const totalMin = useMemo(
    () =>
      atividades
        .filter((a) => a.status !== "CANCELADA")
        .reduce((s, a) => s + (a.duracao_minutos ?? 0), 0),
    [atividades]
  );

  const { success, error: toastError } = useToast();
  const { confirm: confirmar } = useConfirm();

  async function handleDelete(a: AtividadeComPessoa) {
    const ok = await confirmar({
      title: "Excluir atividade?",
      message: `"${a.titulo}" será removida e a entrada de timesheet some junto.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteAtividade(a.id);
      if (r && !r.ok) toastError(r.error ?? "Erro ao excluir atividade.");
      else success("Atividade excluída.");
      router.refresh();
    });
  }

  function Acoes({ a }: { a: AtividadeComPessoa }) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(a);
            setFormOpen(true);
          }}
          aria-label="Editar"
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(a)}
          aria-label="Excluir"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Atividades internas
          </h1>
          <p className="text-sm text-slate-500">
            Pareceres, prazos, audiências e eventos · timesheet automático
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nova atividade</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs text-slate-500">Atividades</p>
          <p className="text-xl font-bold text-slate-800">{atividades.length}</p>
        </div>
        <div className="col-span-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:col-span-3">
          <p className="text-xs text-slate-500">Horas registradas (timesheet)</p>
          <p className="inline-flex items-center gap-1.5 text-xl font-bold text-brand-700">
            <Clock size={18} /> {formatDuration(totalMin)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SelectMenu
          value={fTipo}
          onChange={setFTipo}
          emptyOption="Todos os tipos"
          placeholder="Todos os tipos"
          options={atividadeTipoOptions()}
          className="w-full sm:w-52"
        />
      </div>

      {/* MOBILE */}
      <div className="space-y-3 md:hidden">
        {filtradas.length === 0 && (
          <EmptyState
            title={
              atividades.length === 0
                ? "Nenhuma atividade registrada ainda"
                : "Nenhuma atividade corresponde ao filtro"
            }
            description={
              atividades.length === 0
                ? "Registre despachos, reuniões internas e 1:1s — o timesheet é gerado automaticamente."
                : undefined
            }
            actionLabel={
              atividades.length === 0 ? "Nova atividade" : "Limpar filtro"
            }
            onAction={() => {
              if (atividades.length === 0) {
                setEditing(null);
                setFormOpen(true);
              } else {
                setFTipo("");
              }
            }}
          />
        )}
        {filtradas.map((a) => (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-800">{a.titulo}</span>
              {a.status === "CANCELADA" ? (
                <Badge tone="red">Cancelada</Badge>
              ) : (
                <Badge tone="blue">
                  {TIPO_ATIVIDADE_INTERNA[a.tipo] ?? a.tipo}
                </Badge>
              )}
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <p className="inline-flex items-center gap-1">
                <Calendar size={13} /> {formatDateTime(a.data_hora_inicio)} ·{" "}
                {formatDuration(a.duracao_minutos)}
              </p>
              {podeEscolherPessoa && a.pessoa?.nome && (
                <PersonTag
                  nome={a.pessoa.nome}
                  src={a.pessoa.avatar_url}
                  size={18}
                />
              )}
              {(a.com_pessoa || a.com_pessoa_nome) && (
                <p className="inline-flex items-center gap-1">
                  com{" "}
                  {a.com_pessoa ? (
                    <PersonTag
                      nome={a.com_pessoa.nome}
                      src={a.com_pessoa.avatar_url}
                      size={18}
                    />
                  ) : (
                    a.com_pessoa_nome
                  )}
                </p>
              )}
            </div>
            <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
              <Acoes a={a} />
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Atividade</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              {podeEscolherPessoa && (
                <th className="px-4 py-3 font-medium">Responsável</th>
              )}
              <th className="px-4 py-3 font-medium">Início</th>
              <th className="px-4 py-3 font-medium">Duração</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={podeEscolherPessoa ? 6 : 5}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  Nenhuma atividade encontrada.
                </td>
              </tr>
            )}
            {filtradas.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{a.titulo}</div>
                  {(a.com_pessoa || a.com_pessoa_nome) && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                      com{" "}
                      {a.com_pessoa ? (
                        <PersonTag
                          nome={a.com_pessoa.nome}
                          src={a.com_pessoa.avatar_url}
                          size={16}
                        />
                      ) : (
                        a.com_pessoa_nome
                      )}
                    </div>
                  )}
                  {a.status === "CANCELADA" && (
                    <Badge tone="red">Cancelada</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="blue">{TIPO_ATIVIDADE_INTERNA[a.tipo]}</Badge>
                </td>
                {podeEscolherPessoa && (
                  <td className="px-4 py-3 text-slate-600">
                    {a.pessoa?.nome ? (
                      <PersonTag
                        nome={a.pessoa.nome}
                        src={a.pessoa.avatar_url}
                        size={24}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-slate-600">
                  {formatDateTime(a.data_hora_inicio)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDuration(a.duracao_minutos)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Acoes a={a} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AtividadeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => router.refresh()}
        atividade={editing}
        pessoas={pessoas}
        podeEscolherPessoa={podeEscolherPessoa}
        pessoaAtualId={pessoaAtualId}
      />
    </div>
  );
}
