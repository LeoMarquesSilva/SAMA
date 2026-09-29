-- Colaboradores vindos do ORQESTRAI (cadastro de funcionários), divergências
-- com o Responsum e liberação de módulos por usuário (modelo do SIOE).

alter table public.colaboradores
  alter column responsum_id drop not null,
  add column if not exists orqestrai_id uuid unique,
  add column if not exists cargo text,
  add column if not exists admissao date,
  add column if not exists desligamento date,
  add column if not exists vios_ci text;

create table if not exists public.colaboradores_divergencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'sem_registro_orqestrai',
    'sem_conta_responsum',
    'area_diferente',
    'status_diferente'
  )),
  nome text,
  email text,
  detalhe text,
  detectado_em timestamptz not null default now()
);

alter table public.colaboradores_divergencias enable row level security;

drop policy if exists colaboradores_divergencias_select on public.colaboradores_divergencias;
create policy colaboradores_divergencias_select on public.colaboradores_divergencias
  for select to authenticated using (public.app_is_admin());

create table if not exists public.usuario_modulos (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  modulo text not null check (modulo in (
    'dashboard',
    'calendario',
    'proximos-passos',
    'ajuda',
    'timesheet',
    'usuarios',
    'clientes',
    'relatorios',
    'tarefas'
  )),
  liberado_por uuid references public.usuarios(id) on delete set null,
  liberado_em timestamptz not null default now(),
  primary key (usuario_id, modulo)
);

alter table public.usuario_modulos enable row level security;

drop policy if exists usuario_modulos_select on public.usuario_modulos;
create policy usuario_modulos_select on public.usuario_modulos
  for select to authenticated
  using (usuario_id = public.app_pessoa_id() or public.app_is_admin());

drop policy if exists usuario_modulos_insert on public.usuario_modulos;
create policy usuario_modulos_insert on public.usuario_modulos
  for insert to authenticated with check (public.app_is_admin());

drop policy if exists usuario_modulos_delete on public.usuario_modulos;
create policy usuario_modulos_delete on public.usuario_modulos
  for delete to authenticated using (public.app_is_admin());

-- Mantém o acesso que todos já tinham (admins veem tudo por is_admin).
insert into public.usuario_modulos (usuario_id, modulo)
select u.id, m.modulo
from public.usuarios u
cross join (values ('dashboard'), ('calendario'), ('proximos-passos'), ('ajuda')) as m(modulo)
on conflict do nothing;

create or replace function public.trg_usuario_modulos_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuario_modulos (usuario_id, modulo)
  select new.id, m.modulo
  from (values ('dashboard'), ('calendario'), ('proximos-passos'), ('ajuda')) as m(modulo)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists usuario_modulos_padrao on public.usuarios;
create trigger usuario_modulos_padrao
  after insert on public.usuarios
  for each row execute function public.trg_usuario_modulos_padrao();

-- Colaborador desligado: bloqueia o login no SAMA (middleware exige usuarios.ativo).
create or replace function public.trg_desativar_usuario_ex_colaborador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ativo = false and (tg_op = 'INSERT' or old.ativo is distinct from false) then
    update public.usuarios u
    set ativo = false, atualizado_em = now()
    where u.ativo is distinct from false
      and u.is_admin = false
      and (
        u.id = new.usuario_id
        or lower(u.email) = lower(trim(new.email))
        or (
          split_part(lower(u.email), '@', 1) = split_part(lower(trim(new.email)), '@', 1)
          and split_part(lower(u.email), '@', 2) in ('bpplaw.com.br', 'bismarchipires.com.br')
          and split_part(lower(trim(new.email)), '@', 2) in ('bpplaw.com.br', 'bismarchipires.com.br')
        )
      );
  end if;
  return new;
end;
$$;

drop trigger if exists desativar_usuario_ex_colaborador on public.colaboradores;
create trigger desativar_usuario_ex_colaborador
  after insert or update of ativo on public.colaboradores
  for each row execute function public.trg_desativar_usuario_ex_colaborador();

revoke all on function public.trg_usuario_modulos_padrao() from public, anon, authenticated;
revoke all on function public.trg_desativar_usuario_ex_colaborador() from public, anon, authenticated;
