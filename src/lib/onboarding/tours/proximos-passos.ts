import type { OnboardingStep } from "@/lib/onboarding/types";

export const PROXIMOS_PASSOS_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Próximos passos",
    body: "Aqui ficam as ações combinadas nas reuniões que você já categorizou e marcou como realizadas. Use esta tela para acompanhar o que ainda precisa ser feito.",
    placement: "center",
  },
  {
    id: "header",
    title: "Visão geral",
    body: "O contador no topo mostra quantos passos estão pendentes, quantos já foram concluídos e em quantas reuniões eles estão distribuídos.",
    target: "passos-header",
    placement: "bottom",
  },
  {
    id: "filtros",
    title: "Filtros de status",
    body: "Alterne entre Pendentes (o que ainda falta fazer), Realizadas (já concluídas) ou Todos. Os números ao lado de cada filtro atualizam em tempo real.",
    target: "passos-filtros",
    placement: "bottom",
  },
  {
    id: "busca",
    title: "Busca",
    body: "Digite o nome da reunião, do cliente ou parte do texto do passo para encontrar rapidamente uma ação específica.",
    target: "passos-busca",
    placement: "bottom",
  },
  {
    id: "demo-grupo",
    title: "Agrupado por reunião",
    body: "Cada bloco representa uma reunião. Você vê título, data, tipo, cliente e quantos passos ainda faltam naquela reunião.",
    demo: "passos-grupo",
    placement: "center",
  },
  {
    id: "demo-checklist",
    title: "Marcar como feito",
    body: "Marque o checkbox ao concluir um passo. Ele sai da lista de pendentes e fica registrado como realizado — sem precisar abrir a reunião de novo.",
    demo: "passos-checklist",
    placement: "center",
  },
  {
    id: "demo-ver-reuniao",
    title: "Ver reunião",
    body: "Use Ver reunião para abrir o formulário completo, editar próximos passos, resultado ou participantes daquela reunião.",
    demo: "passos-ver-reuniao",
    placement: "center",
  },
  {
    id: "nav",
    title: "Fluxo completo",
    body: "Calendário → categorizar eventos. Dashboard → ver métricas. Próximos passos → executar combinações. A aba Ajuda traz o manual detalhado.",
    target: "nav-proximos-passos",
    placement: "right",
  },
  {
    id: "finish",
    title: "Tour concluído!",
    body: "Você conheceu as três áreas principais do SAMA. Agora é só usar no dia a dia — categorize reuniões, acompanhe métricas e feche os passos combinados.",
    placement: "center",
    finishLabel: "Começar a usar",
  },
];
