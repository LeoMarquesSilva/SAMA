-- ════════════════════════════════════════════════════════════════════════════
-- SAMA — Migration 0001: Fase 1 (Pessoas e Clientes)
-- ════════════════════════════════════════════════════════════════════════════
-- Execute no SQL Editor do Supabase ou via `supabase db push`.
-- As tabelas das fases seguintes (Reuniões, Atividades, Timesheet, Outlook)
-- serão adicionadas em migrations posteriores.

-- Extensão para gen_random_uuid() (geralmente já habilitada no Supabase).
create extension if not exists "pgcrypto";

-- Função utilitária: atualiza automaticamente a coluna atualizado_em.
create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

-- ─── PESSOAS ──────────────────────────────────────────────────────────────────
create table if not exists public.pessoas (
  id            uuid primary key default gen_random_uuid(),
  -- Vínculo opcional com o usuário de auth (login). Pessoas podem existir
  -- como registro de domínio mesmo sem conta de acesso.
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  nome          text not null,
  email         text not null unique,
  cargo         text not null check (cargo in ('SOCIO', 'GERENTE_AREA', 'COLABORADOR')),
  avatar_url    text,
  outlook_id    text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_pessoas_cargo on public.pessoas (cargo);
create index if not exists idx_pessoas_ativo on public.pessoas (ativo);

create trigger trg_pessoas_atualizado_em
  before update on public.pessoas
  for each row execute function public.set_atualizado_em();

-- ─── CLIENTES ─────────────────────────────────────────────────────────────────
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cnpj          text unique,
  segmento      text,
  status        text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO', 'PROSPECTO')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_clientes_status on public.clientes (status);

create trigger trg_clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.set_atualizado_em();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Fase 1: qualquer usuário autenticado pode ler e escrever. O controle de
-- acesso por nível (sócio vê todos, gerente vê a si mesmo) entra na Fase 5.
alter table public.pessoas enable row level security;
alter table public.clientes enable row level security;

create policy "pessoas_authenticated_all" on public.pessoas
  for all to authenticated using (true) with check (true);

create policy "clientes_authenticated_all" on public.clientes
  for all to authenticated using (true) with check (true);
