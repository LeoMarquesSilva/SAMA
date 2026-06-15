-- SAMA — Migration 0029: tipo de atividade Ciência NF

alter table public.atividades_internas
  drop constraint if exists atividades_internas_tipo_check;

alter table public.atividades_internas
  add constraint atividades_internas_tipo_check
  check (tipo in (
    'PARECER',
    'DESPACHO',
    'REVISAO_PRAZO',
    'ELABORACAO_PRAZO',
    'AUDIENCIA',
    'SUSTENTACAO_ORAL',
    'PALESTRAS_EVENTOS',
    'CIENCIA_NF'
  ));
