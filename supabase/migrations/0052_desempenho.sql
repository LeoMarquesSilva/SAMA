-- Desempenho: índices que faltavam, índice duplicado e upserts sem mudança.

-- FKs usadas em toda tela (contagem de próximos passos, vínculo evento ↔ registro).
create index if not exists idx_outlook_eventos_reuniao_id
  on public.outlook_eventos (reuniao_id) where reuniao_id is not null;
create index if not exists idx_outlook_eventos_atividade_id
  on public.outlook_eventos (atividade_id) where atividade_id is not null;
create index if not exists idx_reunioes_criado_por_id
  on public.reunioes (criado_por_id);

-- Idêntico a idx_reunioes_tipo.
drop index if exists public.idx_reunioes_tipo_fk;

-- O sync do VIOS faz upsert da tabela inteira a cada rodada, e as RPCs de
-- vinculação regravam todas as linhas. Sem mudança real, o UPDATE ainda gera
-- WAL (que o Realtime precisa decodificar) e I/O de disco. Este trigger
-- descarta a gravação quando a linha nova é igual à antiga.
-- O nome começa com "aa_" para rodar antes do trigger de updated_at (ordem alfabética).
create or replace function public.pular_update_sem_mudanca()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) = to_jsonb(old) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists aa_pular_update_sem_mudanca on public.timesheets;
create trigger aa_pular_update_sem_mudanca
  before update on public.timesheets
  for each row execute function public.pular_update_sem_mudanca();

drop trigger if exists aa_pular_update_sem_mudanca on public.processos_completo;
create trigger aa_pular_update_sem_mudanca
  before update on public.processos_completo
  for each row execute function public.pular_update_sem_mudanca();

drop trigger if exists aa_pular_update_sem_mudanca on public.pessoas;
create trigger aa_pular_update_sem_mudanca
  before update on public.pessoas
  for each row execute function public.pular_update_sem_mudanca();
