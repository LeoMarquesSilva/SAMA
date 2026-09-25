import {
  normalizeEscritorioEmail,
  emailsEscritorioIguais,
} from "@/lib/email-escritorio";
import { serializeChecklist } from "@/lib/proximos-passos-checklist";

export type FellowAssigneeRaw = {
  full_name?: string;
  email?: string;
};

export type FellowActionItemRaw = {
  text: string;
  done: boolean;
  prazo: string | null;
  assignees: FellowAssigneeRaw[];
};

export type FellowTodoMapeado = {
  text: string;
  done: boolean;
  prazo: string | null;
  responsavel_email: string | null;
  responsavel_nome: string | null;
  colaborador_id: string | null;
};

export type ColaboradorMatch = {
  id: string;
  nome: string;
  email: string;
};

function normalizeNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchPorEmail(
  email: string,
  colaboradores: ColaboradorMatch[]
): ColaboradorMatch | undefined {
  const alvo = email.trim();
  if (!alvo) return undefined;
  return colaboradores.find((c) => emailsEscritorioIguais(c.email, alvo));
}

function matchPorNome(
  nome: string,
  colaboradores: ColaboradorMatch[]
): ColaboradorMatch | undefined {
  const alvo = normalizeNome(nome);
  if (!alvo) return undefined;
  const exact = colaboradores.find((c) => normalizeNome(c.nome) === alvo);
  if (exact) return exact;
  return colaboradores.find((c) => {
    const n = normalizeNome(c.nome);
    return n.includes(alvo) || alvo.includes(n);
  });
}

/** Resolve assignee Fellow → colaborador SAMA (e-mail primeiro, nome depois). */
export function resolverAssigneeFellow(
  assignees: FellowAssigneeRaw[],
  colaboradores: ColaboradorMatch[]
): ColaboradorMatch | null {
  for (const a of assignees) {
    const email = a.email?.trim();
    if (email) {
      const hit = matchPorEmail(email, colaboradores);
      if (hit) return hit;
    }
  }
  for (const a of assignees) {
    const nome = a.full_name?.trim();
    if (nome) {
      const hit = matchPorNome(nome, colaboradores);
      if (hit) return hit;
    }
  }
  return null;
}

export function mapearActionItemsFellow(
  items: FellowActionItemRaw[],
  colaboradores: ColaboradorMatch[]
): FellowTodoMapeado[] {
  return items.map((item) => {
    const mapped = resolverAssigneeFellow(item.assignees, colaboradores);
    const fallbackEmail = item.assignees.find((a) => a.email?.trim())?.email;
    const fallbackNome = item.assignees.find((a) => a.full_name?.trim())?.full_name;

    return {
      text: item.text,
      done: item.done,
      prazo: item.prazo,
      colaborador_id: mapped?.id ?? null,
      responsavel_email: mapped
        ? normalizeEscritorioEmail(mapped.email)
        : fallbackEmail
          ? normalizeEscritorioEmail(fallbackEmail)
          : null,
      responsavel_nome: mapped?.nome ?? fallbackNome?.trim() ?? null,
    };
  });
}

/** Mesma esteira de Próximos passos — responsável e prazo no checklist. */
export function formatarTodosMapeados(todos: FellowTodoMapeado[]): string {
  return serializeChecklist(
    todos.map((t) => ({
      text: t.text,
      done: t.done,
      colaborador_id: t.colaborador_id,
      prazo: t.prazo,
      responsavel_nome: t.responsavel_nome,
      responsavel_email: t.responsavel_email,
    }))
  );
}
