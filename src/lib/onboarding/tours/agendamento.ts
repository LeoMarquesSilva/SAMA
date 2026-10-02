import type { OnboardingStep } from "@/lib/onboarding/types";

/** Aponta para os controles reais do agendamento, não para um exemplo solto. */
export const AGENDAMENTO_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "agendar",
    title: "A reunião nova começa aqui",
    body: "Clique em Agendar para criar a reunião no SAMA e enviar o convite ao Outlook. O formulário começa como um convite: título, pessoas, horário e sala. O restante é informação do SAMA.",
    target: "agendar-botao",
    placement: "bottom",
  },
  {
    id: "participantes",
    title: "Quem participa",
    body: "Depois do título, convide a equipe interna e os e-mails do cliente. É a partir dessa escolha que o horário mostra se cada pessoa está livre.",
    target: "agenda-participantes",
    placement: "top",
  },
  {
    id: "quando",
    title: "Quando e a sala",
    body: "Escolha o início, o fim e a sala, como no Outlook. Cada participante interno ganha uma faixa, junto com a sala. Rosa é horário ocupado. Clique num trecho livre para preencher o início e o fim.",
    target: "agenda-quando",
    placement: "top",
  },
  {
    id: "pauta",
    title: "O restante fica no SAMA",
    body: "A pauta só aparece na reunião nova: 1. Objetivo, 2. Assuntos a serem tratados e 3. Pendências. O cliente fica logo abaixo do título. Depois de escolhê-lo, o painel de reuniões anteriores surge acima da pauta, e os e-mails de quem já participou daquele grupo entram no convite. Os próximos passos ficam para depois da reunião.",
    target: "agenda-pauta",
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
    id: "finish",
    title: "É por esses pontos",
    body: "Agendar abre o formulário na ordem do convite: título, pessoas, horário e sala. Cliente e pauta vêm depois. A ata e os próximos passos aparecem quando a reunião já aconteceu.",
    placement: "center",
    finishLabel: "Começar a usar",
  },
];
