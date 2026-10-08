-- Pasta de atendimento do VIOS usada ao agendar o compromisso de reunião nova.
-- Cada área (departamento do colaborador) pode ter a sua. Sem pasta, a área
-- não recebe esse compromisso.

create table if not exists public.reuniao_pastas_area (
  area          text primary key,
  pasta         text not null,
  atualizado_em timestamptz not null default now(),
  constraint reuniao_pastas_area_pasta_digitos check (pasta ~ '^[0-9]{1,12}$')
);

drop trigger if exists trg_reuniao_pastas_area_atualizado_em on public.reuniao_pastas_area;
create trigger trg_reuniao_pastas_area_atualizado_em
  before update on public.reuniao_pastas_area
  for each row execute function public.set_atualizado_em();

-- Comportamento que já estava no código: só Reestruturação, pasta 52091.
insert into public.reuniao_pastas_area (area, pasta)
values ('Reestruturação', '52091')
on conflict (area) do nothing;

alter table public.reuniao_pastas_area enable row level security;

drop policy if exists reuniao_pastas_area_select on public.reuniao_pastas_area;
create policy reuniao_pastas_area_select on public.reuniao_pastas_area
  for select to authenticated using (true);

drop policy if exists reuniao_pastas_area_write on public.reuniao_pastas_area;
create policy reuniao_pastas_area_write on public.reuniao_pastas_area
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

revoke all on public.reuniao_pastas_area from anon, public;
grant select, insert, update, delete on public.reuniao_pastas_area to authenticated;
grant all on public.reuniao_pastas_area to service_role;
