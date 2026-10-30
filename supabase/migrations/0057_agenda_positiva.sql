-- SAMA/ECOA — Agenda Positiva: cada cliente (grupo do VIOS) ganha um cluster de
-- prioridade e quantas reuniões deve ter por mês. Configurado em Configurações,
-- lido pelo Dashboard Agenda Positiva, que compara a meta com as reuniões feitas.

create table if not exists public.agenda_positiva_clientes (
  grupo_cliente text primary key,
  -- A = alta, B = média, C = baixa (rótulos em src/lib/agenda-positiva.ts)
  cluster       text not null,
  meta_mensal   int  not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint agenda_positiva_cluster_valido check (cluster in ('A', 'B', 'C')),
  constraint agenda_positiva_meta_valida check (meta_mensal between 1 and 30),
  constraint agenda_positiva_grupo_preenchido check (btrim(grupo_cliente) <> '')
);

drop trigger if exists trg_agenda_positiva_clientes_atualizado_em on public.agenda_positiva_clientes;
create trigger trg_agenda_positiva_clientes_atualizado_em
  before update on public.agenda_positiva_clientes
  for each row execute function public.set_atualizado_em();

-- ─── RLS: todos leem, só admin escreve ───────────────────────────────────────
alter table public.agenda_positiva_clientes enable row level security;

drop policy if exists agenda_positiva_clientes_select on public.agenda_positiva_clientes;
create policy agenda_positiva_clientes_select on public.agenda_positiva_clientes
  for select to authenticated using (true);

drop policy if exists agenda_positiva_clientes_write on public.agenda_positiva_clientes;
create policy agenda_positiva_clientes_write on public.agenda_positiva_clientes
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

revoke all on public.agenda_positiva_clientes from anon, public;
grant select, insert, update, delete on public.agenda_positiva_clientes to authenticated;
grant all on public.agenda_positiva_clientes to service_role;

-- ─── Módulo novo: Agenda Positiva ────────────────────────────────────────────
alter table public.usuario_modulos drop constraint if exists usuario_modulos_modulo_check;
alter table public.usuario_modulos
  add constraint usuario_modulos_modulo_check
  check (modulo in (
    'dashboard',
    'agenda-positiva',
    'calendario',
    'proximos-passos',
    'ajuda',
    'timesheet',
    'usuarios',
    'clientes',
    'relatorios',
    'tarefas',
    'configuracoes'
  ));
