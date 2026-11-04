-- Regras de data do fluxo automático do VIOS, para o Orquestra prever (e o jurídico ajustar) a data de cada
-- tarefa que o VIOS cria junto com a agendada. O robô lê no catálogo semanal:
--   - a aba "Prazos" de cada tipo de tarefa: N dias, "Prazo Negativo" (conta para trás) e dias úteis ou corridos;
--   - a aba "Fluxo Automático - Criação" de cada tipo que cria outros: de onde cada filha conta a data
--     ("data atual" = o dia em que o VIOS a cria; "data para conclusão da tarefa pai"; "data base da tarefa pai").
-- Ex.: AUDIÊNCIA UNA/INICIAL cria CONTESTAÇÃO 15 dias úteis antes da audiência; RECURSO DE REVISTA cria
-- EMBARGOS DE DECLARAÇÃO 3 dias úteis antes, e o Embargos cria o próprio 2. REVISAR e 3. PROTOCOLAR.

alter table public.vios_fluxos_tarefas
  add column if not exists prazo_dias integer,
  add column if not exists prazo_negativo boolean,
  add column if not exists prazo_corridos boolean,
  add column if not exists regras_criacao jsonb;

comment on column public.vios_fluxos_tarefas.prazo_dias is
  'Aba Prazos do tipo no VIOS: dias do prazo (0 = sem prazo). Null = não lido.';
comment on column public.vios_fluxos_tarefas.prazo_negativo is
  'Aba Prazos: "Prazo Negativo" (a data conta para trás a partir da data base).';
comment on column public.vios_fluxos_tarefas.prazo_corridos is
  'Aba Prazos: dias corridos (false = dias úteis).';
comment on column public.vios_fluxos_tarefas.regras_criacao is
  'Aba Fluxo Automático - Criação: [{id, dias, base}] de cada filha; base = atual (dia da criação), pai (data para conclusão da tarefa pai), pai_base (data base da tarefa pai) ou outro. Null = não lido.';
