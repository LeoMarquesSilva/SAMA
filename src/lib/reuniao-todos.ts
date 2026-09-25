import type { FellowTodoMapeado } from "@/lib/fellow-assignees";
import {
  checklistTemItens,
  parseChecklist,
  serializeChecklist,
} from "@/lib/proximos-passos-checklist";

export type ReuniaoTodo = {
  text: string;
  done: boolean;
  prazo: string | null;
  colaborador_id: string | null;
  responsavel_email: string | null;
  responsavel_nome: string | null;
};

export function parseTodos(raw: unknown): ReuniaoTodo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = item as Partial<ReuniaoTodo>;
      const text = String(o.text ?? "").trim();
      if (!text) return null;
      return {
        text,
        done: Boolean(o.done),
        prazo: o.prazo ? String(o.prazo) : null,
        colaborador_id: o.colaborador_id ? String(o.colaborador_id) : null,
        responsavel_email: o.responsavel_email
          ? String(o.responsavel_email)
          : null,
        responsavel_nome: o.responsavel_nome
          ? String(o.responsavel_nome)
          : null,
      };
    })
    .filter((t): t is ReuniaoTodo => t !== null);
}

export function fellowTodosParaReuniao(
  items: FellowTodoMapeado[]
): ReuniaoTodo[] {
  return items.map((t) => ({
    text: t.text,
    done: t.done,
    prazo: t.prazo,
    colaborador_id: t.colaborador_id,
    responsavel_email: t.responsavel_email,
    responsavel_nome: t.responsavel_nome,
  }));
}

/** Fallback quando `todos` jsonb ainda não existe — lê o markdown legado. */
export function todosDeProximosPassos(
  raw: string | null | undefined
): ReuniaoTodo[] {
  return parseChecklist(raw).map((item) => ({
    text: item.text,
    done: item.done,
    prazo: null,
    colaborador_id: null,
    responsavel_email: null,
    responsavel_nome: null,
  }));
}

export function contarTodosPendentes(todos: ReuniaoTodo[]): number {
  return todos.filter((t) => t.text.trim() && !t.done).length;
}

/** Lê jsonb legado `todos` só se a esteira de próximos passos estiver vazia. */
export function proximosPassosUnificados(
  proximosPassos: string | null | undefined,
  todos: unknown
): string {
  if (checklistTemItens(proximosPassos)) return proximosPassos ?? "";
  const legado = parseTodos(todos);
  if (!legado.length) return proximosPassos ?? "";
  return serializeChecklist(legado);
}

export type OrigemReuniao = "SAMA" | "OUTLOOK";

export type ViosEnvioStatus = "enviado" | "erro" | null;
