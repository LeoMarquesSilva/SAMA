export type FellowImportMotivo =
  | "sem_gravacao"
  | "sem_conteudo_ia"
  | "parcial_resumo"
  | "parcial_passos";

export const FELLOW_MSG_SEM_GRAVACAO =
  "Esta reunião não aparece como gravada no Fellow. Preencha resumo e próximos passos manualmente — isso é comum quando a call não foi gravada ou quando quem participou não usa o Fellow.";

export const FELLOW_MSG_SEM_IA =
  "A reunião consta no Fellow, mas sem resumo ou ações geradas pela IA. Pode ser que a gravação não tenha notas automáticas ou que a conta não tenha acesso ao Fellow AI — preencha manualmente.";

export const FELLOW_MSG_PARCIAL_RESUMO =
  "Gravação encontrada no Fellow, mas sem resumo de IA para importar.";

export const FELLOW_MSG_PARCIAL_PASSOS =
  "Gravação encontrada no Fellow, mas sem ações (Action items) para importar.";

export function fellowHintSemGravacao(): string {
  return "Não gravada no Fellow";
}

export function fellowHintSemIa(): string {
  return "Sem notas de IA no Fellow";
}

export function fellowHintNaoEncontrado(): string {
  return "Não encontrado no Fellow";
}
