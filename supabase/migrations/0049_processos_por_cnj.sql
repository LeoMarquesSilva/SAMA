-- CI escolhido quando o mesmo número de processo existe em mais de uma pasta.
alter table public.vios_agendamentos
  add column if not exists ci_pasta text;

comment on column public.vios_agendamentos.ci_pasta is
  'CI da pasta de processo escolhida no SAMA. O robô abre essa pasta em vez de buscar o CNJ.';

-- Espelho do SIOE: vínculo do processo, quando a carga traz.
alter table public.processos_completo
  add column if not exists vinculo text;

create index if not exists idx_processos_completo_cnj_digitos
  on public.processos_completo ((regexp_replace(coalesce(nro_cnj, ''), '\D', '', 'g')));

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
  order by pc.ci;
$$;

revoke all on function public.processos_por_cnj(text) from public;
grant execute on function public.processos_por_cnj(text) to authenticated, service_role;
