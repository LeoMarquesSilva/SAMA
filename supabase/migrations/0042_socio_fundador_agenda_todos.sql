-- SAMA — Sócio fundador (cargo SOCIO + dept Sócio) vê agenda de todos

create or replace function public.app_is_socio_fundador()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select cargo = 'SOCIO' and departamento = 'Sócio'
      from public.usuarios
      where auth_user_id = auth.uid()
      limit 1
    ),
    false
  )
$$;

create or replace function public.app_pode_ver_todas_agendas()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin() or public.app_is_socio_fundador()
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
        and oe.pessoa_id = public.app_pessoa_id()
    )
$$;

-- Outlook: leitura ampliada; escrita só admin ou dono do calendário
drop policy if exists "outlook_eventos_all" on public.outlook_eventos;

create policy "outlook_eventos_select" on public.outlook_eventos
  for select to authenticated
  using (
    public.app_pode_ver_todas_agendas()
    or pessoa_id = public.app_pessoa_id()
  );

create policy "outlook_eventos_insert" on public.outlook_eventos
  for insert to authenticated
  with check (
    public.app_pode_ver_todas_agendas()
    or pessoa_id = public.app_pessoa_id()
  );

create policy "outlook_eventos_update" on public.outlook_eventos
  for update to authenticated
  using (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  )
  with check (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  );

create policy "outlook_eventos_delete" on public.outlook_eventos
  for delete to authenticated
  using (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  );

-- Atividades internas: leitura ampliada no calendário; escrita inalterada
drop policy if exists "atividades_all" on public.atividades_internas;

create policy "atividades_select" on public.atividades_internas
  for select to authenticated
  using (
    public.app_pode_ver_todas_agendas()
    or pessoa_id = public.app_pessoa_id()
  );

create policy "atividades_insert" on public.atividades_internas
  for insert to authenticated
  with check (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  );

create policy "atividades_update" on public.atividades_internas
  for update to authenticated
  using (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  )
  with check (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  );

create policy "atividades_delete" on public.atividades_internas
  for delete to authenticated
  using (
    public.app_is_admin()
    or pessoa_id = public.app_pessoa_id()
  );

revoke execute on function public.app_is_socio_fundador() from anon, public;
revoke execute on function public.app_pode_ver_todas_agendas() from anon, public;
grant execute on function public.app_is_socio_fundador() to authenticated;
grant execute on function public.app_pode_ver_todas_agendas() to authenticated;
