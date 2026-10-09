import type { FaqItem } from "@/lib/ajuda/parse-manual";

/** FAQ mínimo do piloto Reestruturação (ECOA F6.1 / F5.1). */
export const FAQ_ECOA: FaqItem[] = [
  {
    question: "Como agendo uma reunião no SAMA (via B)?",
    answer:
      "No Calendário, use Agendar. O cliente começa vazio. Preencha participantes, pauta (objetivo, assuntos e pendências), e-mails do cliente e sala ou Somente online. O SAMA cria o convite no Outlook com a pauta no corpo e o link do Teams — também nas presenciais. Próximos passos não entram na reunião nova.",
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
    question: "Como trago a pauta da reunião anterior?",
    answer:
      "Na reunião nova, ao escolher o cliente, aparece o painel de reuniões anteriores. Dá para trazer a pauta. Os próximos passos dessa reunião anterior não entram no agendamento novo: eles ficam para depois que a reunião acontecer.",
  },
  {
    question: "Como envio a ata ao cliente?",
    answer:
      "Na reunião realizada, a seção Ata mostra o texto do Fellow. Enviar ata para cliente manda esse texto. O botão só habilita com a ata preenchida e ao menos um e-mail do cliente. A pauta não é o que esse botão envia.",
  },
  {
    question: "Como envio próximos passos ao VIOS?",
    answer:
      "Em qualquer reunião, use Enviar para Agendamento nos próximos passos. Na tela a etiqueta é só Providência ou Prazo. Providência grava no VIOS PROVIDÊNCIA e PROVIDÊNCIA DE REUNIÃO. Prazo grava ENVIAR e PROVIDÊNCIA DE REUNIÃO. O VIOS cria o fluxo (Ciência dos agendamentos, 2. REVISAR e Protocolar). Ciência fica com o responsável. Protocolar fica com o responsável e com Samuel Willian Silva. A 2. REVISAR fica com o revisor. Se o processo tiver mais de uma pasta ativa, escolha o CI antes de enviar. Com uma pasta ativa, o CI entra sozinho.",
  },
  {
    question: "Quando Lavínia e Lígia entram na providência?",
    answer:
      "Quando a demanda é Insolvência, Cível-Insolvência ou Insolvência e Cível-Insolvência, Lavínia e Lígia já vêm marcadas na providência e na 2. REVISAR do fluxo. Dá para tirar uma das duas ou incluir outra pessoa antes de enviar. A tarefa ENVIAR do prazo fica só com o responsável. Demanda Não definida não sugere as duas.",
  },
  {
    question: "Como cancelo uma reunião que eu criei no SAMA?",
    answer:
      "Abra a reunião Agendada ou Reagendada criada pelo SAMA e use Cancelar reunião. Informe o motivo e confirme. O convite também é cancelado no Outlook.",
  },
  {
    question: "O piloto Ômega / Reestruturação já vale para as outras áreas?",
    answer:
      "Não. Até 30/09 o piloto é só Reestruturação (via A, via B, sala e cliente Ômega). As demais áreas entram depois.",
  },
];
