-- SAMA — Tipo de reunião: Eventos e Palestras

alter table public.reunioes
  drop constraint if exists reunioes_tipo_check;

alter table public.reunioes
  add constraint reunioes_tipo_check
  check (tipo in (
    'CAPTACAO',
    'FIDELIZACAO',
    'RELACIONAMENTO_INSTITUCIONAL',
    'GESTAO_ESTRATEGICA',
    'GESTAO_EQUIPE',
    'GESTAO_OPERACIONAL',
    'EVENTOS_PALESTRAS'
  ));
