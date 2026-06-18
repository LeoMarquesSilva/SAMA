-- SAMA — Migration 0039: tour guiado de Próximos passos

alter table public.usuarios
  add column if not exists onboarding_proximos_passos_concluido boolean not null default true;

comment on column public.usuarios.onboarding_proximos_passos_concluido is
  'Tour guiado de Próximos passos já concluído pelo usuário.';

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
  elsif tour = 'proximos_passos' then
    update public.usuarios
    set onboarding_proximos_passos_concluido = true
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
