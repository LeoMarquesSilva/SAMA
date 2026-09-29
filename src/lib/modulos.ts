/** Módulos liberáveis por usuário (espelha o CHECK de public.usuario_modulos). */
export const MODULOS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", descricao: "Visão geral de metas e atividades" },
  { key: "calendario", label: "Calendário", href: "/calendario", descricao: "Agenda, reuniões e categorização do Outlook" },
  { key: "proximos-passos", label: "Próximos passos", href: "/proximos-passos", descricao: "Ações combinadas nas reuniões" },
  { key: "ajuda", label: "Ajuda", href: "/ajuda", descricao: "Manual e perguntas frequentes" },
  { key: "timesheet", label: "Horas", href: "/timesheet", descricao: "Timesheet (em desenvolvimento)" },
  { key: "usuarios", label: "Usuários", href: "/pessoas", descricao: "Cadastro de pessoas, logins e módulos" },
  { key: "clientes", label: "Clientes", href: "/clientes", descricao: "Grupos, empresas e CIs" },
  { key: "relatorios", label: "Relatórios", href: "/relatorios", descricao: "Relatórios e exportações" },
  { key: "tarefas", label: "Tarefas VIOS", href: "/tarefas", descricao: "Tarefas sincronizadas do VIOS" },
] as const;

export type ModuloKey = (typeof MODULOS)[number]["key"];

export const MODULOS_PADRAO: ModuloKey[] = ["dashboard", "calendario", "proximos-passos", "ajuda"];

const CHAVES = new Set<string>(MODULOS.map((m) => m.key));

export function isModuloKey(valor: string): valor is ModuloKey {
  return CHAVES.has(valor);
}

export function temModulo(
  ctx: { isAdmin: boolean; modulos: readonly string[] },
  modulo: ModuloKey
): boolean {
  return ctx.isAdmin || ctx.modulos.includes(modulo);
}

/** Primeira página liberada (destino quando o usuário abre um módulo sem acesso). */
export function primeiraRotaLiberada(ctx: { isAdmin: boolean; modulos: readonly string[] }): string | null {
  return MODULOS.find((m) => temModulo(ctx, m.key))?.href ?? null;
}
