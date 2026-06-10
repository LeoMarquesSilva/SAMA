-- SAMA — Migration 0007: controle de acesso por papel (RLS)
-- Admin (sócio fundador) vê tudo; demais veem apenas o que lhes pertence.

-- ── Funções auxiliares (security definer p/ evitar recursão de RLS) ──
create or replace function public.app_pessoa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.pessoas where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.pessoas where auth_user_id = auth.uid() limit 1),
    false
  )
$$;

create or replace function public.app_can_see_reuniao(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin()
    or exists (
      select 1 from public.reuniao_participantes rp
      where rp.reuniao_id = rid and rp.pessoa_id = public.app_pessoa_id()
    )
    or exists (
      select 1 from public.reunioes r
      where r.id = rid and r.criado_por_id = public.app_pessoa_id()
    )
$$;

-- ── PESSOAS: todos leem (dropdowns/participantes); só admin gerencia ──
drop policy if exists "pessoas_authenticated_all" on public.pessoas;
create policy "pessoas_select" on public.pessoas
  for select to authenticated using (true);
create policy "pessoas_insert" on public.pessoas
  for insert to authenticated with check (public.app_is_admin());
create policy "pessoas_update" on public.pessoas
  for update to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy "pessoas_delete" on public.pessoas
  for delete to authenticated using (public.app_is_admin());

-- ── CLIENTES: recurso compartilhado — todos autenticados ──
drop policy if exists "clientes_authenticated_all" on public.clientes;
create policy "clientes_all" on public.clientes
  for all to authenticated using (true) with check (true);

-- ── REUNIÕES: admin tudo; demais veem onde participam ou que criaram ──
drop policy if exists "reunioes_auth_all" on public.reunioes;
create policy "reunioes_select" on public.reunioes
  for select to authenticated using (public.app_can_see_reuniao(id));
create policy "reunioes_insert" on public.reunioes
  for insert to authenticated
  with check (public.app_is_admin() or criado_por_id = public.app_pessoa_id());
create policy "reunioes_update" on public.reunioes
  for update to authenticated
  using (public.app_is_admin() or criado_por_id = public.app_pessoa_id())
  with check (public.app_is_admin() or criado_por_id = public.app_pessoa_id());
create policy "reunioes_delete" on public.reunioes
  for delete to authenticated
  using (public.app_is_admin() or criado_por_id = public.app_pessoa_id());

-- ── PARTICIPANTES: visíveis se a reunião é visível; gerencia quem criou/admin ──
drop policy if exists "participantes_auth_all" on public.reuniao_participantes;
create policy "participantes_select" on public.reuniao_participantes
  for select to authenticated using (public.app_can_see_reuniao(reuniao_id));
create policy "participantes_manage" on public.reuniao_participantes
  for all to authenticated
  using (
    public.app_is_admin()
    or exists (select 1 from public.reunioes r where r.id = reuniao_id and r.criado_por_id = public.app_pessoa_id())
  )
  with check (
    public.app_is_admin()
    or exists (select 1 from public.reunioes r where r.id = reuniao_id and r.criado_por_id = public.app_pessoa_id())
  );

-- ── ATIVIDADES INTERNAS: admin tudo; demais só as próprias ──
drop policy if exists "atividades_auth_all" on public.atividades_internas;
create policy "atividades_all" on public.atividades_internas
  for all to authenticated
  using (public.app_is_admin() or pessoa_id = public.app_pessoa_id())
  with check (public.app_is_admin() or pessoa_id = public.app_pessoa_id());

-- ── TIMESHEET: admin tudo; demais só as próprias ──
drop policy if exists "timesheet_auth_all" on public.timesheet_entradas;
create policy "timesheet_all" on public.timesheet_entradas
  for all to authenticated
  using (public.app_is_admin() or pessoa_id = public.app_pessoa_id())
  with check (public.app_is_admin() or pessoa_id = public.app_pessoa_id());

-- ── OUTLOOK EVENTOS: admin tudo; demais só os próprios ──
drop policy if exists "outlook_eventos_auth_all" on public.outlook_eventos;
create policy "outlook_eventos_all" on public.outlook_eventos
  for all to authenticated
  using (public.app_is_admin() or pessoa_id = public.app_pessoa_id())
  with check (public.app_is_admin() or pessoa_id = public.app_pessoa_id());

-- logs: mantém aberto a autenticados (baixa sensibilidade)
drop policy if exists "outlook_logs_auth_all" on public.outlook_sync_logs;
create policy "outlook_logs_all" on public.outlook_sync_logs
  for all to authenticated using (true) with check (true);
