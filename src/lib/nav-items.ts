import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  BarChart3,
  Target,
  ListTodo,
  ListChecks,
  Clock,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import {
  canAccessClientes,
  canAccessRelatorios,
  canAccessTarefas,
  canAccessTimesheet,
  canAccessUsuarios,
  type NavContext,
} from "@/lib/nav-access";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: (ctx: NavContext) => boolean;
  /** Oculto no menu mobile (ex.: relatórios — só desktop). */
  hideOnMobile?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    visible: () => true,
  },
  {
    href: "/calendario",
    label: "Calendário",
    icon: CalendarDays,
    visible: () => true,
  },
  {
    href: "/proximos-passos",
    label: "Próximos passos",
    icon: ListChecks,
    visible: () => true,
  },
  {
    href: "/ajuda",
    label: "Ajuda",
    icon: CircleHelp,
    visible: () => true,
  },
  {
    href: "/timesheet",
    label: "Horas",
    icon: Clock,
    visible: canAccessTimesheet,
  },
  {
    href: "/pessoas",
    label: "Usuários",
    icon: Users,
    visible: canAccessUsuarios,
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Building2,
    visible: canAccessClientes,
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    visible: canAccessRelatorios,
    hideOnMobile: true,
  },
  {
    href: "/tarefas",
    label: "Tarefas VIOS",
    icon: ListTodo,
    visible: canAccessTarefas,
  },
];

export const NAV_BRAND = {
  name: "SAMA",
  fullName: "Sistema de Análise de Metas e Atividades",
  icon: Target,
} as const;

export function visibleNavItems(
  ctx: NavContext,
  opts?: { mobile?: boolean }
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.visible(ctx)) return false;
    if (opts?.mobile && item.hideOnMobile) return false;
    return true;
  });
}

/** Rotas fixas na barra inferior do mobile. */
export const MOBILE_TAB_HREFS = new Set([
  "/dashboard",
  "/calendario",
  "/proximos-passos",
]);

export function mobileMenuItems(ctx: NavContext): NavItem[] {
  return visibleNavItems(ctx, { mobile: true }).filter(
    (item) => !MOBILE_TAB_HREFS.has(item.href)
  );
}
