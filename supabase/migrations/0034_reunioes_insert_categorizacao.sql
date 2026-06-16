-- SAMA — Permite categorização de reuniões por qualquer usuário autenticado.
-- Antes: insert bloqueava quando criado_por_id não batia com app_pessoa_id() (RLS).

create or replace function public.app_can_manage_reuniao(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin()
    or exists (
      select 1 from public.reunioes r
      where r.id = rid and r.criado_por_id = public.app_pessoa_id()
    )
$$;

drop policy if exists "reunioes_insert" on public.reunioes;
create policy "reunioes_insert" on public.reunioes
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "participantes_manage" on public.reuniao_participantes;
create policy "participantes_manage" on public.reuniao_participantes
  for all to authenticated
  using (public.app_can_manage_reuniao(reuniao_id))
  with check (public.app_can_manage_reuniao(reuniao_id));
