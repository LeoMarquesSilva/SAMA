import type { FaqItem } from "@/lib/ajuda/parse-manual";

/** FAQ mínimo do piloto Reestruturação (ECOA F6.1 / F5.1). */
export const FAQ_ECOA: FaqItem[] = [
  {
    question: "Como agendo uma reunião no SAMA (via B)?",
    answer:
      "No Calendário, use Agendar. Preencha cliente, participantes, pauta (objetivo, assuntos e pendências), e-mails do cliente e sala ou Somente online. O SAMA cria o convite no Outlook com a pauta no corpo e o link do Teams — também nas presenciais.",
  },
  {
    question: "E se o compromisso já estiver no Outlook (via A)?",
    answer:
      "Continua igual: o calendário importa o evento, você categoriza como reunião e pode completar a pauta depois. Título e horários da via A vêm do Outlook.",
  },
  {
    question: "Como escolho a sala (Sala 1, Sala 2, Biblioteca, Outback)?",
    answer:
      "No agendamento, selecione a sala. No escritório as salas são caixas de usuário (SALA01, SALA02, BIBLIOTECA, OUTBACK), não lugares do Graph. O SAMA convida essa pessoa/recurso no Outlook. Somente online não reserva sala física.",
  },
  {
    question: "Como trago a pauta e os próximos passos da reunião anterior?",
    answer:
      "Ao escolher o cliente, aparece o painel de reuniões anteriores. Marque o que quer trazer (pauta e/ou próximos passos) e clique em Aplicar selecionados. Os passos entram na esteira de Próximos passos.",
  },
  {
    question: "Como envio próximos passos ao VIOS?",
    answer:
      "Escreva os próximos passos na reunião, salve e clique em Enviar para Agendamento. O envio leva tipo, tarefa, observação, data e pasta para a app local de agendamento VIOS (porta 3920).",
  },
  {
    question: "O piloto Ômega / Reestruturação já vale para as outras áreas?",
    answer:
      "Não. Até 30/09 o piloto é só Reestruturação (via A, via B, sala e cliente Ômega). As demais áreas entram depois.",
  },
];
