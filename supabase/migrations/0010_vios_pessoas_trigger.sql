-- SAMA — Migration 0010: atualiza atualizado_em a cada upsert no vios_pessoas
create trigger trg_vios_pessoas_atualizado_em
  before update on public.vios_pessoas
  for each row execute function public.set_atualizado_em();
