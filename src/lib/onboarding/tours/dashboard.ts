import type { OnboardingStep } from "@/lib/onboarding/types";

export const DASHBOARD_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao Dashboard",
    body: "Aqui você acompanha reuniões e atividades realizadas no período. Use os números para entender onde está investindo seu tempo.",
    placement: "center",
  },
  {
    id: "filtros",
    title: "Período e filtros",
    body: "Escolha o intervalo (dia, mês, trimestre, ano) e, se for admin, filtre por colaborador ou tipo de reunião. Todos os cards abaixo respeitam esses filtros.",
    target: "dashboard-filtros",
    placement: "bottom",
  },
  {
    id: "cards",
    title: "Agenda consolidada",
    body: "Cada card mostra quantas reuniões ou atividades realizadas você teve naquele tipo. O card laranja indica itens do calendário ainda não categorizados — clique para ir direto ao Calendário.",
    target: "dashboard-cards",
    placement: "top",
  },
  {
    id: "grafico",
    title: "Distribuição",
    body: "O gráfico resume a proporção entre tipos de reunião e atividade no período. Passe o mouse (ou toque) nos segmentos para ver os valores.",
    target: "dashboard-grafico",
    placement: "left",
  },
  {
    id: "proximas",
    title: "Próximas reuniões",
    body: "Quando houver reuniões agendadas nos próximos 7 dias, elas aparecem aqui com link para entrar na call online.",
    target: "dashboard-proximas",
    placement: "top",
  },
  {
    id: "nav-calendario",
    title: "Navegação rápida",
    body: "Use o menu lateral (ou a barra inferior no celular) para alternar entre Dashboard, Calendário e Próximos passos.",
    target: "nav-calendario",
    placement: "right",
  },
  {
    id: "finish",
    title: "Dashboard concluído!",
    body: "Agora conheça Próximos passos — onde você acompanha e marca como feitas as ações combinadas nas reuniões.",
    placement: "center",
    finishLabel: "Concluir tour",
    nextHref: "/proximos-passos",
    nextHrefLabel: "Ir para Próximos passos",
  },
];
