import type { CargoPessoa } from "@/lib/constants";
import { temModulo } from "@/lib/modulos";

export type NavContext = {
  cargo: CargoPessoa;
  isAdmin: boolean;
  /** Módulos liberados em usuario_modulos (admins veem tudo). */
  modulos: string[];
};

export function canAccessDashboard(ctx: NavContext): boolean {
  return temModulo(ctx, "dashboard");
}

export function canAccessCalendario(ctx: NavContext): boolean {
  return temModulo(ctx, "calendario");
}

export function canAccessProximosPassos(ctx: NavContext): boolean {
  return temModulo(ctx, "proximos-passos");
}

export function canAccessAjuda(ctx: NavContext): boolean {
  return temModulo(ctx, "ajuda");
}

export function canAccessUsuarios(ctx: NavContext): boolean {
  return temModulo(ctx, "usuarios");
}

export function canAccessClientes(ctx: NavContext): boolean {
  return temModulo(ctx, "clientes");
}

/** Horas (timesheet) — em desenvolvimento. */
export function canAccessTimesheet(ctx: NavContext): boolean {
  return temModulo(ctx, "timesheet");
}

export function canAccessRelatorios(ctx: NavContext): boolean {
  return temModulo(ctx, "relatorios");
}

export function canAccessTarefas(ctx: NavContext): boolean {
  return temModulo(ctx, "tarefas");
}

export function canAccessConfiguracoes(ctx: NavContext): boolean {
  return temModulo(ctx, "configuracoes");
}

/** Exportação CSV/PDF completa — apenas administradores. */
export function canExportRelatorios(ctx: { isAdmin: boolean; cargo?: CargoPessoa }): boolean {
  return ctx.isAdmin;
}
