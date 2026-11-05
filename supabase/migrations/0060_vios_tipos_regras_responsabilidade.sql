-- Regras de responsabilidade de cada tipo de tarefa no VIOS (Cadastro de Tipo de Tarefa › Responsabilidade), para o
-- Orquestra mostrar na vistagem e na conferência quem o VIOS e o robô põem em cada tarefa que o fluxo cria junto.
-- O robô já lê essa página no catálogo semanal (para os responsáveis fixos) e passa a gravar também as marcações:
--   - advogado / auxiliar: o VIOS põe o advogado ou o auxiliar do processo;
--   - estagiario: o estagiário do processo (ex.: INSERIR PAUTA + ATUALIZAR SISTEMA, HABILITAÇÃO PROCESSUAL);
--   - coordenador / grupo: o coordenador ou um grupo de responsáveis.
-- Os responsáveis fixos continuam em vios_tipos_tarefa.responsaveis (ex.: VERIFICAR ATA = Larissa).

alter table public.vios_tipos_tarefa
  add column if not exists regras_responsabilidade jsonb;

comment on column public.vios_tipos_tarefa.regras_responsabilidade is
  'Cadastro do tipo no VIOS › Responsabilidade: {advogado, auxiliar, estagiario, coordenador, grupo} (booleanos). Null = não lido. Os fixos ficam em responsaveis.';
