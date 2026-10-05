-- Revisor escolhido no SAMA. O robô aplica essa pessoa na 2. REVISAR
-- que o VIOS cria sozinho no fluxo, em vez de abrir outra tarefa.
alter table public.vios_agendamentos
  add column if not exists revisor text;
