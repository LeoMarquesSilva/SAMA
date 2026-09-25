-- ECOA F1.2 + F2.7 + F3.2 + F4.3
-- RLS: próprias + mesma área; todo SOCIO vê tudo.
-- Colunas: pauta, origem, todos, sala, envio VIOS/SharePoint.

-- ─── Colunas reunioes ────────────────────────────────────────────────────────
alter table public.reunioes
  add column if not exists pauta jsonb,
  add column if not exists origem text,
  add column if not exists todos jsonb,
  add column if not exists sala text,
  add column if not exists emails_cliente text[],
  add column if not exists sharepoint_item_id text,
  add column if not exists vios_envio_status text,
  add column if not exists vios_envio_erro text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reunioes_origem_check'
  ) then
    alter table public.reunioes
      add constraint reunioes_origem_check
      check (origem is null or origem in ('SAMA', 'OUTLOOK'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'reunioes_vios_envio_status_check'
  ) then
    alter table public.reunioes
      add constraint reunioes_vios_envio_status_check
      check (vios_envio_status is null or vios_envio_status in ('enviado', 'erro'));
  end if;
end $$;

update public.reunioes
  set origem = case
    when outlook_event_id is not null then 'OUTLOOK'
    else 'SAMA'
  end
  where origem is null;

-- ─── Helpers de permissão ────────────────────────────────────────────────────
create or replace function public.app_is_socio()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select cargo = 'SOCIO' from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  )
$$;

create or replace function public.app_departamento()
returns text language sql stable security definer set search_path = public as $$
  select departamento from public.usuarios where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.app_mesmo_departamento(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select u.departamento is not null
        and u.departamento = public.app_departamento()
      from public.usuarios u
      where u.id = uid
    ),
    false
  )
$$;

create or replace function public.app_pode_ver_todas_agendas()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or public.app_is_socio()
$$;

create or replace function public.app_pode_ver_agenda_de(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_pode_ver_todas_agendas()
    or uid = public.app_pessoa_id()
    or public.app_mesmo_departamento(uid)
$$;

create or replace function public.app_can_see_reuniao(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_pode_ver_todas_agendas()
    or exists (
      select 1
      from public.reuniao_participantes rp
      join public.colaboradores c on c.id = rp.colaborador_id
      where rp.reuniao_id = rid
        and c.usuario_id = public.app_pessoa_id()
    )
    or exists (
      select 1 from public.reunioes r
      where r.id = rid and r.criado_por_id = public.app_pessoa_id()
    )
    or exists (
      select 1 from public.outlook_eventos oe
      where oe.reuniao_id = rid
        and public.app_pode_ver_agenda_de(oe.pessoa_id)
    )
    or exists (
      select 1
      from public.reunioes r
      join public.usuarios u on u.id = r.criado_por_id
      where r.id = rid
        and public.app_mesmo_departamento(u.id)
    )
$$;

-- ─── Policies ────────────────────────────────────────────────────────────────
drop policy if exists "outlook_eventos_select" on public.outlook_eventos;
create policy "outlook_eventos_select" on public.outlook_eventos
  for select to authenticated
  using (public.app_pode_ver_agenda_de(pessoa_id));

drop policy if exists "atividades_select" on public.atividades_internas;
create policy "atividades_select" on public.atividades_internas
  for select to authenticated
  using (public.app_pode_ver_agenda_de(pessoa_id));

revoke execute on function public.app_is_socio() from anon, public;
revoke execute on function public.app_departamento() from anon, public;
revoke execute on function public.app_mesmo_departamento(uuid) from anon, public;
revoke execute on function public.app_pode_ver_agenda_de(uuid) from anon, public;
grant execute on function public.app_is_socio() to authenticated;
grant execute on function public.app_departamento() to authenticated;
grant execute on function public.app_mesmo_departamento(uuid) to authenticated;
grant execute on function public.app_pode_ver_agenda_de(uuid) to authenticated;
