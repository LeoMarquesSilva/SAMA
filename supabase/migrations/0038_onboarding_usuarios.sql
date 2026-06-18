-- SAMA — Migration 0038: tours de onboarding (calendário e dashboard)

alter table public.usuarios
  add column if not exists onboarding_calendario_concluido boolean not null default true,
  add column if not exists onboarding_dashboard_concluido boolean not null default true;

comment on column public.usuarios.onboarding_calendario_concluido is
  'Tour guiado do Calendário já concluído pelo usuário.';
comment on column public.usuarios.onboarding_dashboard_concluido is
  'Tour guiado do Dashboard já concluído pelo usuário.';

create or replace function public.concluir_onboarding(tour text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if tour = 'calendario' then
    update public.usuarios
    set onboarding_calendario_concluido = true
    where auth_user_id = auth.uid();
  elsif tour = 'dashboard' then
    update public.usuarios
    set onboarding_dashboard_concluido = true
    where auth_user_id = auth.uid();
  else
    raise exception 'Tour inválido: %', tour;
  end if;

  if not found then
    raise exception 'Perfil não encontrado para este login.';
  end if;
end;
$$;

revoke all on function public.concluir_onboarding(text) from public;
grant execute on function public.concluir_onboarding(text) to authenticated;
