-- SAMA — Novos tipos de atividade interna

update public.atividades_internas
set tipo = 'REVISAO_PRAZO'
where tipo = 'REVISAO_PECA';

update public.atividades_internas
set tipo = 'DESPACHO'
where tipo in ('REUNIAO_INTERNA', 'REUNIAO_GESTAO', 'UM_A_UM', 'OUTROS');

update public.timesheet_entradas te
set categoria = a.tipo
from public.atividades_internas a
where te.atividade_interna_id = a.id;

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
    'PALESTRAS_EVENTOS'
  ));
