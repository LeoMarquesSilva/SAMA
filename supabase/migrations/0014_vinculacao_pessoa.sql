-- SAMA — Migration 0014: funções de match e vinculação pessoa_id (espelho SIOE)
-- Usadas pelo sync VIOS após upsert em processos_completo / timesheets.

create extension if not exists unaccent;

create or replace function public.normalize_for_exact_match(t text)
returns text language sql immutable as $$
  select lower(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.normalize_cliente_for_match(t text)
returns text language sql immutable as $$
  select lower(trim(
    regexp_replace(
      regexp_replace(coalesce(unaccent(t), ''), '\s+', ' ', 'g'),
      '\.\s*$', ''
    )
  ));
$$;

create or replace function public.processos_completo_vinculacao_pessoa()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  by_simple bigint;
  by_exact bigint;
  by_nome bigint;
begin
  with updated as (
    update processos_completo pc
    set pessoa_id = p.id
    from pessoas p
    where pc.cliente is not null and trim(pc.cliente) <> ''
      and lower(trim(pc.cliente)) = lower(trim(p.nome))
      and (pc.pessoa_id is null or pc.pessoa_id is distinct from p.id)
    returning pc.id
  )
  select count(*) into by_simple from updated;

  with updated as (
    update processos_completo pc
    set pessoa_id = p.id
    from pessoas p
    where pc.pessoa_id is null
      and pc.cliente is not null and trim(pc.cliente) <> ''
      and public.normalize_for_exact_match(pc.cliente) = public.normalize_for_exact_match(p.nome)
    returning pc.id
  )
  select count(*) into by_exact from updated;

  with updated as (
    update processos_completo pc
    set pessoa_id = p.id
    from pessoas p
    where pc.pessoa_id is null
      and pc.cliente is not null and trim(pc.cliente) <> ''
      and public.normalize_cliente_for_match(pc.cliente) = public.normalize_cliente_for_match(p.nome)
    returning pc.id
  )
  select count(*) into by_nome from updated;

  return by_simple + by_exact + by_nome;
end;
$$;

create or replace function public.timesheets_vinculacao_pessoa()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  by_simple bigint;
  by_exact bigint;
  by_nome bigint;
begin
  with updated as (
    update timesheets t
    set pessoa_id = p.id
    from pessoas p
    where t.cliente is not null and trim(t.cliente) <> ''
      and lower(trim(t.cliente)) = lower(trim(p.nome))
      and (t.pessoa_id is null or t.pessoa_id is distinct from p.id)
    returning t.id
  )
  select count(*) into by_simple from updated;

  with updated as (
    update timesheets t
    set pessoa_id = p.id
    from pessoas p
    where t.pessoa_id is null
      and t.cliente is not null and trim(t.cliente) <> ''
      and public.normalize_for_exact_match(t.cliente) = public.normalize_for_exact_match(p.nome)
    returning t.id
  )
  select count(*) into by_exact from updated;

  with updated as (
    update timesheets t
    set pessoa_id = p.id
    from pessoas p
    where t.pessoa_id is null
      and t.cliente is not null and trim(t.cliente) <> ''
      and public.normalize_cliente_for_match(t.cliente) = public.normalize_cliente_for_match(p.nome)
    returning t.id
  )
  select count(*) into by_nome from updated;

  return by_simple + by_exact + by_nome;
end;
$$;

grant execute on function public.processos_completo_vinculacao_pessoa() to authenticated, service_role;
grant execute on function public.timesheets_vinculacao_pessoa() to authenticated, service_role;
