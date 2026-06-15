-- SAMA — Migration 0026: categorização de tarefas VIOS (espelha outlook_eventos)

alter table public.vios_tarefas
  add column if not exists status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'CATEGORIZADO_REUNIAO', 'CATEGORIZADO_ATIVIDADE', 'IGNORADO')),
  add column if not exists atividade_id uuid references public.atividades_internas (id) on delete set null,
  add column if not exists reuniao_id uuid references public.reunioes (id) on delete set null,
  add column if not exists categorizado_em timestamptz;

create index if not exists idx_vios_tarefas_status on public.vios_tarefas (status);

-- Permite que responsáveis categorizem suas tarefas (update); insert/delete continua admin.
drop policy if exists "vios_tarefas_write" on public.vios_tarefas;

create policy "vios_tarefas_insert" on public.vios_tarefas
  for insert to authenticated
  with check (public.app_is_admin());

create policy "vios_tarefas_update" on public.vios_tarefas
  for update to authenticated
  using (
    public.app_is_admin()
    or usuario_id = public.app_pessoa_id()
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(vios_tarefas.responsaveis, '[]'::jsonb)
          || coalesce(vios_tarefas.auxiliares, '[]'::jsonb)
      ) as nome_el(nome)
      join public.usuarios u on u.id = public.app_pessoa_id()
      where lower(trim(nome_el.nome)) = lower(trim(u.nome))
    )
  )
  with check (
    public.app_is_admin()
    or usuario_id = public.app_pessoa_id()
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(vios_tarefas.responsaveis, '[]'::jsonb)
          || coalesce(vios_tarefas.auxiliares, '[]'::jsonb)
      ) as nome_el(nome)
      join public.usuarios u on u.id = public.app_pessoa_id()
      where lower(trim(nome_el.nome)) = lower(trim(u.nome))
    )
  );

create policy "vios_tarefas_delete" on public.vios_tarefas
  for delete to authenticated
  using (public.app_is_admin());
