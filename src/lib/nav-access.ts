import type { CargoPessoa } from "@/lib/constants";

export type NavContext = {
  cargo: CargoPessoa;
  isAdmin: boolean;
};

/** Usuários — apenas administradores (is_admin). */
export function canAccessUsuarios(ctx: NavContext): boolean {
  return ctx.isAdmin;
}

/** Clientes — apenas administradores (is_admin). */
export function canAccessClientes(ctx: NavContext): boolean {
  return ctx.isAdmin;
}

/** Horas (timesheet) — em desenvolvimento; apenas administradores. */
export function canAccessTimesheet(ctx: NavContext): boolean {
  return ctx.isAdmin;
}

/** Relatórios — em desenvolvimento; apenas administradores. */
export function canAccessRelatorios(ctx: NavContext): boolean {
  return ctx.isAdmin;
}

/** Tarefas VIOS — apenas administradores (sync/mapa interno). */
export function canAccessTarefas(ctx: NavContext): boolean {
  return ctx.isAdmin;
}

/** Exportação CSV/PDF completa — apenas administradores. */
export function canExportRelatorios(ctx: NavContext): boolean {
  return ctx.isAdmin;
}
