"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { CORES_TIPO, type TipoReuniaoItem } from "@/lib/reuniao-tipos";
import {
  atualizarTipoReuniao,
  criarTipoReuniao,
  excluirTipoReuniao,
  moverTipoReuniao,
} from "@/app/(app)/configuracoes/actions";

type Form = {
  label: string;
  descricao: string;
  ativo: boolean;
  grupo_interno: boolean;
  cor: string | null;
};

const FORM_VAZIO: Form = {
  label: "",
  descricao: "",
  ativo: true,
  grupo_interno: false,
  cor: CORES_TIPO[0],
};

function plural(n: number): string {
  return n === 1 ? "1 reunião" : `${n} reuniões`;
}

export function TiposReuniaoClient({
  tipos,
  podeEditar,
}: {
  tipos: TipoReuniaoItem[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const { success, error: erroToast } = useToast();
  const { confirm } = useConfirm();
  const [pending, start] = useTransition();
  /** null = fechado; "" = criando; chave = editando. */
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setEditando("");
  }

  function abrirEdicao(t: TipoReuniaoItem) {
    setForm({
      label: t.label,
      descricao: t.descricao,
      ativo: t.ativo,
      grupo_interno: t.grupo_interno,
      cor: t.cor ?? CORES_TIPO[0],
    });
    setEditando(t.chave);
  }

  function salvar() {
    const chave = editando;
    if (chave === null) return;
    start(async () => {
      const r = chave
        ? await atualizarTipoReuniao(chave, form)
        : await criarTipoReuniao(form);
      if (!r.ok) {
        erroToast(r.error ?? "Não foi possível salvar.");
        return;
      }
      success(chave ? "Tipo atualizado." : "Tipo criado.");
      setEditando(null);
      router.refresh();
    });
  }

  function excluir(t: TipoReuniaoItem) {
    void (async () => {
      const ok = await confirm({
        title: `Excluir "${t.label}"?`,
        message:
          "O tipo sai da lista para sempre. Se quiser apenas parar de oferecê-lo em reuniões novas, desative-o — assim o histórico mantém o nome.",
        confirmLabel: "Excluir",
        tone: "danger",
      });
      if (!ok) return;
      start(async () => {
        const r = await excluirTipoReuniao(t.chave);
        if (!r.ok) {
          erroToast(r.error ?? "Não foi possível excluir.");
          return;
        }
        success("Tipo excluído.");
        router.refresh();
      });
    })();
  }

  function mover(t: TipoReuniaoItem, direcao: "cima" | "baixo") {
    start(async () => {
      const r = await moverTipoReuniao(t.chave, direcao);
      if (!r.ok) {
        erroToast(r.error ?? "Não foi possível reordenar.");
        return;
      }
      router.refresh();
    });
  }

  const ativos = tipos.filter((t) => t.ativo).length;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Tags size={16} className="text-brand-600" />
            Tipos de classificação de reunião
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {ativos} de {tipos.length} oferecidos ao classificar uma reunião. A
            ordem aqui é a ordem do campo Tipo.
          </p>
        </div>
        {podeEditar && (
          <Button type="button" size="sm" onClick={abrirNovo} disabled={pending}>
            <Plus size={14} />
            Novo tipo
          </Button>
        )}
      </div>

      {!podeEditar && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Só administradores podem alterar estes tipos.
        </p>
      )}

      <ul className="space-y-2">
        {tipos.map((t, i) => (
          <li
            key={t.chave}
            className={clsx(
              "rounded-xl border p-3",
              t.ativo
                ? "border-slate-200 bg-white"
                : "border-slate-200 bg-slate-50/70"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1 h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-slate-900/10"
                style={{ backgroundColor: t.cor ?? "#94a3b8" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={clsx(
                      "text-sm font-medium",
                      t.ativo ? "text-slate-800" : "text-slate-500"
                    )}
                  >
                    {t.label}
                  </span>
                  {t.ativo ? (
                    <Badge tone="green">Em uso</Badge>
                  ) : (
                    <Badge tone="gray">Desativado</Badge>
                  )}
                  {t.grupo_interno && (
                    <Badge tone="blue">
                      <Building2 size={11} className="mr-1" />
                      Cliente interno
                    </Badge>
                  )}
                  {typeof t.em_uso === "number" && t.em_uso > 0 && (
                    <span className="text-xs text-slate-400">
                      {plural(t.em_uso)}
                    </span>
                  )}
                </div>
                {t.descricao && (
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
                    {t.descricao}
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {t.chave}
                </p>
              </div>
              {podeEditar && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || i === 0}
                    onClick={() => mover(t, "cima")}
                    aria-label={`Subir ${t.label}`}
                  >
                    <ArrowUp size={14} className="text-slate-400" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || i === tipos.length - 1}
                    onClick={() => mover(t, "baixo")}
                    aria-label={`Descer ${t.label}`}
                  >
                    <ArrowDown size={14} className="text-slate-400" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => abrirEdicao(t)}
                    aria-label={`Editar ${t.label}`}
                  >
                    <Pencil size={14} className="text-slate-400" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || (t.em_uso ?? 0) > 0}
                    title={
                      (t.em_uso ?? 0) > 0
                        ? `${plural(t.em_uso ?? 0)} usam este tipo — desative em vez de excluir.`
                        : undefined
                    }
                    onClick={() => excluir(t)}
                    aria-label={`Excluir ${t.label}`}
                  >
                    <Trash2 size={14} className="text-slate-400" />
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={editando !== null}
        onClose={() => !pending && setEditando(null)}
        title={editando ? "Editar tipo" : "Novo tipo de classificação"}
        size="lg"
        closeDisabled={pending}
      >
        <div className="space-y-4">
          <Input
            label="Nome do tipo"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Ex.: Operacional"
            required
          />
          <Textarea
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={5}
            placeholder="O que entra neste tipo. Aparece como ajuda no campo Tipo da reunião."
          />

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Cor no dashboard
            </span>
            <div className="flex flex-wrap gap-2">
              {CORES_TIPO.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setForm({ ...form, cor })}
                  aria-label={`Cor ${cor}`}
                  aria-pressed={form.cor === cor}
                  className={clsx(
                    "h-7 w-7 rounded-full ring-1 ring-inset ring-slate-900/10 transition",
                    form.cor === cor &&
                      "ring-2 ring-offset-2 ring-offset-white ring-brand-500"
                  )}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0 text-sm">
              <span className="font-medium text-slate-700">
                Oferecer ao classificar uma reunião
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                Desligado, o tipo sai do campo Tipo mas continua nomeando as
                reuniões que já o usam.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.grupo_interno}
              onChange={(e) =>
                setForm({ ...form, grupo_interno: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0 text-sm">
              <span className="font-medium text-slate-700">
                Reunião interna do escritório
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                Ao escolher este tipo, o cliente é preenchido automaticamente com
                o grupo interno e o que estava selecionado é substituído. Deixe
                desligado para reunião de cliente.
              </span>
            </span>
          </label>

          {editando ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              O identificador{" "}
              <span className="font-mono text-slate-600">{editando}</span> não
              muda: é ele que está gravado nas reuniões já classificadas.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setEditando(null)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={salvar} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
