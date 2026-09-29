-- SAMA — Migration 0045: tour das novidades de agendamento (a partir de 29/09/2026)
-- default false: quem já usa o sistema vê o tour uma vez na próxima entrada.

alter table public.usuarios
  add column if not exists onboarding_agendamento_concluido boolean not null default false;

comment on column public.usuarios.onboarding_agendamento_concluido is
  'Tour das novidades de agendamento (pauta, disponibilidade e VIOS) já concluído.';

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
  elsif tour = 'agendamento' then
    update public.usuarios
    set onboarding_agendamento_concluido = true
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
