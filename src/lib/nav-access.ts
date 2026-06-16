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

/** Relatórios — sócio, sócio de área e administradores. */
export function canAccessRelatorios(ctx: NavContext): boolean {
  return (
    ctx.isAdmin ||
    isAdminCargo(ctx.cargo) ||
    ctx.cargo === "SOCIO_AREA"
  );
}

/** Tarefas VIOS — apenas administradores (sync/mapa interno). */
export function canAccessTarefas(ctx: NavContext): boolean {
  return ctx.isAdmin;
}

/** Exportação CSV/PDF completa — sócio fundador e administradores. */
export function canExportRelatorios(ctx: NavContext): boolean {
  return ctx.isAdmin || isAdminCargo(ctx.cargo);
}
