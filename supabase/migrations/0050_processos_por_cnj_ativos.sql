-- A escolha de CI só considera pasta com situação Ativo.
create or replace function public.processos_por_cnj(p_digitos text)
returns table (
  ci text,
  situacao_processo text,
  acao text,
  nro_cnj text
)
language sql
stable
security invoker
set search_path = public
as $$
  select pc.ci, pc.situacao_processo, pc.acao, pc.nro_cnj
  from public.processos_completo pc
  where length(regexp_replace(coalesce(p_digitos, ''), '\D', '', 'g')) = 20
    and regexp_replace(coalesce(pc.nro_cnj, ''), '\D', '', 'g')
      = regexp_replace(p_digitos, '\D', '', 'g')
    and upper(btrim(coalesce(pc.situacao_processo, ''))) = 'ATIVO'
  order by pc.ci;
$$;
