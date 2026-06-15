-- SAMA — Migration 0027: coluna tarefa_pai (nome da tarefa pai no VIOS)

alter table public.vios_tarefas
  add column if not exists tarefa_pai text;
