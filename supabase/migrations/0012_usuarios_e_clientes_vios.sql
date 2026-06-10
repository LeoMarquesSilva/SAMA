-- SAMA — Migration 0012: pessoas → usuarios; clientes passa a ser o espelho do VIOS.

-- ── 1. pessoas → usuarios ──
alter table public.pessoas rename to usuarios;

-- Funções de RLS que referenciavam "pessoas" textualmente.
create or replace function public.app_pessoa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  )
$$;

-- ── 2. clientes (manual, 3 linhas de teste) sai; vios_pessoas vira clientes ──
alter table public.reunioes drop constraint if exists reunioes_cliente_id_fkey;
drop table public.clientes;

alter table public.vios_pessoas rename to clientes;

-- reunioes.cliente_id passa a apontar para clientes.ci (text)
alter table public.reunioes
  alter column cliente_id type text using cliente_id::text;
alter table public.reunioes
  add constraint reunioes_cliente_id_fkey
  foreign key (cliente_id) references public.clientes (ci) on delete set null;

-- Índice de busca por nome (listagem/busca com 37k linhas)
create index if not exists idx_clientes_nome_lower on public.clientes (lower(nome));
