-- SAMA — Migration 0024: espelho de tarefas processuais do VIOS (API BP)

create table if not exists public.vios_tarefas (
  id                  uuid primary key default gen_random_uuid(),
  ci                  text not null,
  ci_do_processo      text,
  data_para_conclusao date,
  data_limite         date,
  horario             text,
  nro_cnj             text,
  area_do_processo    text,
  objeto_do_processo  text,
  pasta               text,
  pasta_cliente       text,
  tarefa              text,
  descricao           text,
  cliente             text,
  grupo_cliente       text,
  partes_ativas       jsonb not null default '[]'::jsonb,
  partes_passivas     jsonb not null default '[]'::jsonb,
  comentarios         jsonb not null default '[]'::jsonb,
  historico           jsonb not null default '[]'::jsonb,
  responsaveis        jsonb not null default '[]'::jsonb,
  auxiliares          jsonb not null default '[]'::jsonb,
  usuario_id          uuid references public.usuarios (id) on delete set null,
  sincronizado_em     timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists vios_tarefas_ci_key on public.vios_tarefas (ci);
create index if not exists idx_vios_tarefas_data_limite on public.vios_tarefas (data_limite);
create index if not exists idx_vios_tarefas_usuario on public.vios_tarefas (usuario_id);
create index if not exists idx_vios_tarefas_cliente on public.vios_tarefas (lower(cliente));

create trigger trg_vios_tarefas_atualizado_em
  before update on public.vios_tarefas
  for each row execute function public.set_updated_at();

alter table public.vios_tarefas enable row level security;

create policy "vios_tarefas_select" on public.vios_tarefas
  for select to authenticated
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
  );

create policy "vios_tarefas_write" on public.vios_tarefas
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());
