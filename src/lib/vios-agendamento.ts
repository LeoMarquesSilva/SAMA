export const VIOS_TIPOS_AGENDAMENTO = [
  "Agendamento Processual",
  "Providências",
  "Recorrência",
] as const;

export const VIOS_TAREFAS_PROVIDENCIA = [
  "JUNTADA DE AR / MANDADO",
  "JUNTADA NEGATIVA DE AR",
  "ANÁLISAR TRÂNSITO EM JULGADO",
  "VERIFICAR AUDIÊNCIA - ALTERAÇÃO/INCLUSÃO/CANCELAMENTO DE AUDIÊNCIA",
  "ACOMPANHAMENTO PROCESSUAL DIÁRIO",
  "INSERIR PAUTA + ATUALIZAR SISTEMA",
  "ANÁLISE PROCESSO",
  "CIÊNCIA NF",
  "VERIFICAR RENÚNCIA",
  "ACOMPANHAMENTO PROCESSUAL SEMANAL",
  "NOVA DEMANDA - ANALISAR/INFORMAR CLIENTE - CAPTURADO AUTOMATICAMENTE",
  "VERIFICAR ENCERRAMENTO DA PASTA",
  "SOLICITAR EVENTUAL AGENDAMENTO",
  "EMITIR GUIAS",
  "VERIFICAR AR",
  "VERIFICAR DESARQUIVAMENTO DO PROCESSO",
  "ACOMPANHAMENTO PROCESSUAL",
  "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA",
  "PROCESSO SUSPENSO - ALTERADO FASE PROCESSUAL",
  "CIÊNCIA DA ABERTURA DE PASTA",
  "ENVIAR DEFESA PARA VALIDAÇÃO DO CLIENTE",
  "SOLICITAR AGENDAMENTO DA REUNIAO PREVIA À PERÍCIA",
  "VERIFICAR FIM DA SUSPENSÃO /SOBRESTAMENTO",
  "INICIADO LIQUIDAÇÃO - ALTERADO FASE PROCESSUAL",
  "VERIFICAR AUDIÊNCIA - ALTERAÇÃO/INCLUSÃO/CANCELAMENTO DE AUDIÊNCIA - ALTERAR PAUTA",
  "ATUALIZAÇÃO DE CADASTRO",
  "CIÊNCIA DA PUBLICACÃO E VIABILIDADE SUSTENTACÃO ORAL",
  "JULGADO PROCEDENTE O PEDIDO DE IDPJ",
  "1. CIÊNCIA DOS AGENDAMENTOS",
  "INFORMAR CLIENTE",
  "ATUALIZAÇÃO DA SÍNTESE DO PROCESSO",
  "LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO PROCESSUAL",
  "PREPARO APELAÇÃO/RE/RESP/AI/REXT/RI",
  "RELATÓRIO DA PERÍCIA + AGENDAR PRAZO DE ENTREGA PARECER TÉCNICO",
  "SOLICITAR/ATUALIZAR CÁLCULOS",
  "SUBSÍDIOS / PROCURAÇÃO",
  "VERIFICAR ATA",
  "ANÁLISAR SUSPENSÃO",
  "ANÁLISAR TRÂNSITO EM JULGADO - TRABALHISTA",
  "CIÊNCIA ATA + ENVIAR RELATÓRIO",
  "ENVIAR ANÁLISE DE RISCO AO CLIENTE + VALOR ATUALIZADO",
  "SESSÃO DE JULGAMENTO",
  "ACOMPANHAMENTO PROCESSUAL + AGENDAR EVENTUAL MF",
  "HOMOLOGADA A TRANSAÇÃO",
  "INICIADA A EXECUÇÃO - ALTERADO FASE PROCESSUAL",
  "SUBSÍDIOS E PROCURAÇÃO + QUESTIONAR PGTO DÍVIDA",
  "ALERTA DE AUDIÊNCIA/JULGAMENTO",
  "ATUALIZAR PROJURIS",
  "AUD. CONCILIAÇÃO",
  "CONFERIR ATUALIZAÇÃO DA SÍNTESE DO PROCESSO",
  "ELABORAR DOCUMENTOS",
  "ENVIAR CUSTAS/GUIA AO CLIENTE",
  "PDI - DESENVOLVIMENTO/EXECUÇÃO/GESTÃO",
  "REALIZAR FATURAMENTO",
  "PERÍCIA",
  "AUDIÊNCIA UNA/INICIAL",
  "ALTERAR RESP/ÁREA. DO PROCESSO",
  "INCLUIR ETIQUETA - DEMANDA DE RISCO",
  "LEMBRAR CLIENTE DO ACORDO",
  "ORGANIZAR DOCS TUTELA / RE / RJ",
  "SANEAMENTO",
  "AUD. INSTRUÇÃO",
  "ATUALIZAÇÃO DA SÍNTESE DO PROCESSO REESTRUTURAÇÃO",
  "REVISAR DOCUMENTO",
  "SUBSÍDIOS E PROCURAÇÃO",
  "ANALISAR E RESPONDER - E-MAIL DE CONTATO",
  "VERIFICAR DOCUMENTOS",
  "REUNIÃO / ATENDIMENTO AO CLIENTE",
  "REUNIÃO DE GESTÃO",
  "ATUALIZAR PLANILHA",
  "ATUALIZAR PLANILHA MENSAL",
  "LEILÃO",
  "REUNIÃO INTERNA",
  "INFORMAR CLIENTE + SUBSÍDIOS DE PENHORA",
] as const;

export const VIOS_TAREFAS_AGENDAMENTO_PROCESSUAL = [
  "CONTESTAÇÃO",
  "EMENDA/ADITAMENTO À INICIAL",
  "IMPUGNAÇÃO À PENHORA DE BENS",
  "AGRAVO DE INSTRUMENTO",
  "COMPROVAR PAGAMENTO",
  "CONTRAMINUTA - I",
  "CONTRARRAZÕES",
  "AGRAVO EM RECURSO ESPECIAL - ARESP",
  "IMPUGNAÇÃO AO CUMPRIMENTO DE SENTENÇA",
  "MANIFESTAÇÃO - FLUXO D1",
  "RECURSO ESPECIAL/EXTRAORDINÁRIO",
  "EMBARGOS DE DECLARAÇÃO",
  "MEMORIAIS",
  "PROPOSTA/CONTRATO DE HONORÁRIOS",
  "RAZÕES FINAIS",
  "REGULARIZAÇÃO PROCESSUAL",
  "RESPOSTA AOS EMBARGOS DE DECLARAÇÃO",
  "APELAÇÃO",
  "APRESENTAÇÃO/IMPUGNAÇÃO AO IDPJ",
  "HABILITAÇÃO PROCESSUAL",
  "INDICAÇÃO/ESPECIFICAÇÃO DE PROVAS",
  "PETIÇÃO INICIAL",
  "RECURSO DE REVISTA",
  "RÉPLICA",
  "AGRAVO DE PETIÇÃO",
  "AIRR",
  "CONSULTIVO",
  "CONTRAMINUTA",
  "NOTIFICAÇÃO EXTRAJUDICIAL",
  "EMBARGOS MONITÓRIOS",
  "EXCEÇÃO DE PRÉ EXECUTIVIDADE",
  "EMBARGOS À EXECUÇÃO",
  "ENVIAR DUE DILLIGENCE PROSPECT",
] as const;

export function tarefasPorTipoAgendamento(tipo: string): readonly string[] {
  if (
    tipo === "Agendamento Processual" ||
    tipo === "AGENDAMENTO PROCESSUAL"
  ) {
    return VIOS_TAREFAS_AGENDAMENTO_PROCESSUAL;
  }
  return VIOS_TAREFAS_PROVIDENCIA;
}

export const VIOS_AREAS = [
  "INSOLVÊNCIA",
  "CÍVEL",
  "TRABALHISTA",
  "TRIBUTÁRIO",
  "CÍVEL | INSOLVÊNCIA",
  "COMERCIAL",
  "CONTRATOS",
  "RECUPERAÇÃO DE CRÉDITO",
  "SPECIAL SITUATIONS",
] as const;

export const VIOS_DESCRICAO_PRAZO = "PROVIDÊNCIAS";

/** Sugestão inicial na providência quando a demanda da reunião é de Insolvência. */
export const RESPONSAVEIS_EXTRA_INSOLVENCIA = [
  "Lavinia Ferraz Crispim",
  "Ligia Gilberti Lopes",
] as const;

export function demandaIncluiInsolvencia(demanda?: string | null): boolean {
  return (
    demanda === "INSOLVENCIA" ||
    demanda === "CIVEL" ||
    demanda === "INSOLVENCIA_CIVEL"
  );
}

function nomeViosIgual(a: string, b: string): boolean {
  const n = (s: string) =>
    s.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toUpperCase();
  return n(a) === n(b);
}

/** Nomes do catálogo do VIOS, quando existirem; senão o nome conhecido. */
export function coparticipantesPadraoInsolvencia(
  usuarios?: readonly { nome: string }[]
): string[] {
  return RESPONSAVEIS_EXTRA_INSOLVENCIA.map((nome) => {
    const achado = usuarios?.find((u) => nomeViosIgual(u.nome, nome));
    return achado?.nome ?? nome;
  });
}

/** Responsável principal mais quem ficou marcado na lista. Não repete nome. */
export function juntarResponsaveis(principal: string, extras: readonly string[]): string {
  const lista: string[] = [];
  const add = (nome: string) => {
    const n = nome.trim();
    if (!n || lista.some((x) => nomeViosIgual(x, n))) return;
    lista.push(n);
  };
  add(principal);
  for (const extra of extras) add(extra);
  return lista.join(", ");
}

export const VIOS_PASTA_TIPOS = ["Processo", "Atendimento"] as const;

export type ViosPassoEnvio = {
  text: string;
  colaborador_id: string;
  prazo: string;
  tipo: string;
  tarefa?: string;
  /** Ids/nomes exatos do VIOS (vindos de vios-opcoes). */
  tarefa_id?: string;
  etiqueta_id?: string;
  etiqueta?: string;
  /** Nome do responsável exatamente como no VIOS. */
  responsavel_vios?: string;
  /** Revisor do prazo. O robô coloca essa pessoa na 2. REVISAR que o fluxo do VIOS cria. */
  revisor_vios?: string;
  /** Texto original do item em "Próximos passos" (liga o item à tarefa do VIOS). */
  texto_checklist?: string;
  area?: string;
  pastaTipo?: string;
  pasta?: string;
  processo?: string;
  /** CI da pasta de processo, quando o mesmo CNJ existe em mais de uma. */
  ci_pasta?: string;
};

export type PastaProcessoOpcao = {
  ci: string;
  situacao_processo: string | null;
  acao: string | null;
  nro_cnj: string | null;
};
