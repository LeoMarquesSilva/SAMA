import type { OnboardingStep } from "@/lib/onboarding/types";

/** Aponta para os controles reais do agendamento, não para um exemplo solto. */
export const AGENDAMENTO_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "agendar",
    title: "A reunião nova começa aqui",
    body: "Clique em Agendar para criar a reunião no SAMA e enviar o convite ao Outlook. A pauta e a escolha de horário ficam nesse formulário.",
    target: "agendar-botao",
    placement: "bottom",
  },
  {
    id: "pauta",
    title: "Pauta, nesta ordem",
    body: "Preencha 1. Objetivo, 2. Assuntos a serem tratados e 3. Pendências. Isso só aparece na reunião nova. Depois de escolher o cliente, o painel de reuniões anteriores surge acima da pauta para trazer o que já foi combinado.",
    target: "agenda-pauta",
    placement: "top",
  },
  {
    id: "participantes",
    title: "Quem participa",
    body: "Selecione a equipe interna aqui. É a partir dessa escolha que o horário mostra se cada pessoa está livre.",
    target: "agenda-participantes",
    placement: "top",
  },
  {
    id: "quando",
    title: "Livre e ocupado",
    body: "Cada participante interno ganha uma faixa, junto com a sala. Rosa é horário ocupado. Clique num trecho livre para preencher o início e o fim.",
    target: "agenda-quando",
    placement: "top",
  },
  {
    id: "ata",
    title: "A ata fica aqui",
    body: "Quando a reunião está realizada, este campo recebe o texto do Fellow. Use Buscar novamente para atualizar. Não há outro campo de ata para preencher à mão.",
    target: "agenda-ata",
    placement: "top",
  },
  {
    id: "passos",
    title: "Próximos passos e o VIOS",
    body: "Escreva cada ação numa linha. Depois que a reunião passou, o botão Enviar para Agendamento aparece neste bloco. Na linha do passo entram o CI e o status da tarefa: Aberta, Concluída ou Cancelada.",
    target: "agenda-passos",
    placement: "top",
  },
  {
    id: "finish",
    title: "É por esses pontos",
    body: "Agendar abre o formulário. A pauta e as pessoas ficam no meio. O horário mostra quem está livre. A ata e os passos para o VIOS aparecem quando a reunião já aconteceu.",
    placement: "center",
    finishLabel: "Começar a usar",
  },
];
