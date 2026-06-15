-- SAMA — Migration 0028: conclusão VIOS + visibilidade de tarefas cumpridas por Sócio de Área

alter table public.vios_tarefas
  add column if not exists vios_status text,
  add column if not exists usuario_concluiu text,
  add column if not exists usuario_concluiu_id uuid references public.usuarios (id) on delete set null,
  add column if not exists data_conclusao date,
  add column if not exists hora_conclusao text;

create index if not exists idx_vios_tarefas_usuario_concluiu
  on public.vios_tarefas (usuario_concluiu_id);

drop policy if exists "vios_tarefas_select" on public.vios_tarefas;

create policy "vios_tarefas_select" on public.vios_tarefas
  for select to authenticated
  using (
    public.app_is_admin()
    or usuario_id = public.app_pessoa_id()
    or usuario_concluiu_id = public.app_pessoa_id()
    or exists (
      select 1
      from public.usuarios u
      where u.id = vios_tarefas.usuario_concluiu_id
        and u.cargo = 'SOCIO_AREA'
    )
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
