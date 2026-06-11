-- SAMA — Migration 0023: colaboradores do Responsum para seleção de participantes.

create table if not exists public.colaboradores (
  id              uuid primary key default gen_random_uuid(),
  responsum_id    uuid not null unique,
  nome            text not null,
  email           text not null,
  departamento    text,
  avatar_url      text,
  ativo           boolean not null default true,
  usuario_id      uuid references public.usuarios (id) on delete set null,
  sincronizado_em timestamptz not null default now()
);

create unique index if not exists idx_colaboradores_email_lower
  on public.colaboradores (lower(email));
create index if not exists idx_colaboradores_departamento
  on public.colaboradores (departamento);
create index if not exists idx_colaboradores_usuario
  on public.colaboradores (usuario_id);

-- Participantes passam a referenciar colaboradores (não usuarios do SAMA).
alter table public.reuniao_participantes
  drop constraint if exists reuniao_participantes_pessoa_id_fkey;

alter table public.reuniao_participantes
  rename column pessoa_id to colaborador_id;

alter table public.reuniao_participantes
  add constraint reuniao_participantes_colaborador_id_fkey
  foreign key (colaborador_id) references public.colaboradores (id) on delete cascade;

drop index if exists idx_participantes_pessoa;
create index if not exists idx_participantes_colaborador
  on public.reuniao_participantes (colaborador_id);

alter table public.reuniao_participantes
  drop constraint if exists reuniao_participantes_reuniao_id_pessoa_id_key;

alter table public.reuniao_participantes
  add constraint reuniao_participantes_reuniao_id_colaborador_id_key
  unique (reuniao_id, colaborador_id);

-- Visibilidade de reuniões: participação via colaborador vinculado ao usuário logado.
create or replace function public.app_can_see_reuniao(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin()
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
$$;

-- RLS: colaboradores são leitura para autenticados; sync via service role.
alter table public.colaboradores enable row level security;

drop policy if exists "colaboradores_select" on public.colaboradores;
create policy "colaboradores_select" on public.colaboradores
  for select to authenticated using (true);
