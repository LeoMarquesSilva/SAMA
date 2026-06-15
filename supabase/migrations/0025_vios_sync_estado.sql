-- SAMA — Migration 0025: controle de cota/rate limit da API VIOS

create table if not exists public.vios_sync_estado (
  recurso              text primary key,
  ultima_sincronia     timestamptz,
  bloqueado_ate        timestamptz,
  ultimo_erro          text,
  consultas_no_ciclo   smallint not null default 0,
  ciclo_inicio         timestamptz,
  updated_at           timestamptz not null default now()
);

insert into public.vios_sync_estado (recurso)
values ('tarefas')
on conflict (recurso) do nothing;

alter table public.vios_sync_estado enable row level security;

create policy "vios_sync_estado_select" on public.vios_sync_estado
  for select to authenticated using (true);

create policy "vios_sync_estado_write" on public.vios_sync_estado
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());
