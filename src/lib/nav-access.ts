import { isAdminCargo, type CargoPessoa } from "@/lib/constants";

export type NavContext = {
  cargo: CargoPessoa;
  isAdmin: boolean;
};

/** Usuários — sócio fundador e administradores. */
export function canAccessUsuarios(ctx: NavContext): boolean {
  return ctx.isAdmin || isAdminCargo(ctx.cargo);
}

/** Clientes — sócio fundador e administradores (não sócio de área). */
export function canAccessClientes(ctx: NavContext): boolean {
  return ctx.isAdmin || isAdminCargo(ctx.cargo);
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

/** Exportação CSV/PDF completa — sócio fundador e administradores. */
export function canExportRelatorios(ctx: NavContext): boolean {
  return ctx.isAdmin || isAdminCargo(ctx.cargo);
}
