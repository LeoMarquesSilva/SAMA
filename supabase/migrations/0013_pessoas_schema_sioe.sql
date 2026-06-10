-- SAMA — Migration 0013: schema de clientes igual ao SIOE (pessoas + processos + timesheets + grupos)
-- Limpa dados/colunas errados de clientes/vios_* e recria espelhando o SIOE.
-- Escrita via service_role (sync VIOS); leitura para autenticados.

-- ── 1. Views dependentes ──
drop view if exists public.escritorio_grupos_resumo cascade;
drop view if exists public.escritorio_empresas_por_grupo cascade;
drop view if exists public.pessoas_escritorio cascade;
drop view if exists public.contagem_ci_por_grupo cascade;
drop view if exists public.timesheets_resumo_por_grupo_ano cascade;

-- ── 2. Desvincula reuniões dos clientes antigos ──
alter table public.reunioes drop constraint if exists reunioes_cliente_id_fkey;
update public.reunioes set cliente_id = null where cliente_id is not null;

-- ── 3. Remove tabelas antigas (dados incorretos) ──
drop table if exists public.clientes cascade;
drop table if exists public.vios_processos_completo cascade;
drop table if exists public.vios_timesheets cascade;

-- ── 4. Trigger helper (SIOE usa updated_at, não atualizado_em) ──
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 5. PESSOAS (clientes/empresas do VIOS — espelho SIOE) ──
create table public.pessoas (
  id                    uuid primary key default gen_random_uuid(),
  ci                    text,
  etiquetas             text,
  cpf_cnpj              text,
  nome                  text not null,
  nome_fantasia_apelido text,
  tipo                  text,
  data_cadastro         date,
  cidade                text,
  uf                    text,
  logradouro            text,
  nro                   text,
  complemento           text,
  bairro                text,
  cep                   text,
  abreviacao            text,
  responsaveis          text,
  telefone              text,
  email                 text,
  grupo_cliente         text,
  categoria             text,
  contato_1             text,
  facebook              text,
  instagram             text,
  linkedin              text,
  site                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index pessoas_upsert_key on public.pessoas (ci) nulls not distinct;
create index idx_pessoas_ci on public.pessoas (ci) where ci is not null and ci <> '';
create index idx_pessoas_cpf_cnpj on public.pessoas (cpf_cnpj) where cpf_cnpj is not null and cpf_cnpj <> '';
create index idx_pessoas_grupo_cliente on public.pessoas (grupo_cliente);
create index idx_pessoas_nome on public.pessoas (nome);
create index idx_pessoas_categoria on public.pessoas (categoria);
create index idx_pessoas_updated_at on public.pessoas (updated_at desc);

create trigger pessoas_updated_at
  before update on public.pessoas
  for each row execute function public.set_updated_at();

comment on table public.pessoas is
  'Clientes/pessoas do VIOS (espelho SIOE). Equipe interna fica em public.usuarios.';

-- ── 6. PROCESSOS COMPLETO ──
create table public.processos_completo (
  id                    uuid primary key default gen_random_uuid(),
  ci                    text,
  grupo_cliente         text,
  departamento          text,
  area                  text,
  advogado_responsavel  text,
  cliente               text not null,
  acao                  text,
  acao_data_cadastro    text,
  data_cadastro         date,
  fase_processual       text,
  nro_cnj               text,
  processo_encerrado    text,
  situacao_processo     text,
  motivo_encerramento   text,
  etiquetas             text,
  data_encerramento     date,
  pessoa_id             uuid references public.pessoas (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index processos_completo_upsert_key on public.processos_completo (ci) nulls not distinct;
create index idx_processos_completo_ci on public.processos_completo (ci);
create index idx_processos_completo_cliente on public.processos_completo (cliente);
create index idx_processos_completo_grupo_cliente on public.processos_completo (grupo_cliente);
create index idx_processos_completo_pessoa_id on public.processos_completo (pessoa_id);
create index idx_processos_completo_situacao on public.processos_completo (situacao_processo);

create trigger processos_completo_updated_at
  before update on public.processos_completo
  for each row execute function public.set_updated_at();

-- ── 7. TIMESHEETS (horas VIOS — diferente de timesheet_entradas do app) ──
create table public.timesheets (
  id                      uuid primary key default gen_random_uuid(),
  ci                      text,
  data                    date not null,
  cobrar                  text,
  grupo_cliente           text,
  cliente                 text not null,
  parte_contraria         text,
  area                    text,
  nro_processo            text,
  origem                  text,
  ci_atendimento_processo text,
  pasta_interna_processo  text,
  pasta_contrato          text,
  colaborador             text,
  tipo_apontamento        text,
  tipo_tarefa             text,
  descricao               text,
  hora_inicial            text,
  hora_final              text,
  total_horas             numeric,
  total_horas_decimal     numeric,
  valor_hora              numeric,
  valor_total             numeric,
  contrato                text,
  pessoa_id               uuid references public.pessoas (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index timesheets_upsert_key on public.timesheets (ci) nulls not distinct;
create index idx_timesheets_cliente on public.timesheets (cliente);
create index idx_timesheets_data on public.timesheets (data);
create index idx_timesheets_grupo_cliente on public.timesheets (grupo_cliente);
create index idx_timesheets_pessoa_id on public.timesheets (pessoa_id);

create trigger timesheets_updated_at
  before update on public.timesheets
  for each row execute function public.set_updated_at();

-- ── 8. Views: pessoas ↔ grupos ↔ empresas (SIOE) ──
create view public.pessoas_escritorio as
with pc_count as (
  select pessoa_id, count(*)::integer as qtd_processos
  from public.processos_completo
  where pessoa_id is not null
  group by pessoa_id
),
th_total as (
  select pessoa_id, coalesce(sum(total_horas_decimal), 0)::numeric(12, 2) as horas_total
  from public.timesheets
  where pessoa_id is not null
  group by pessoa_id
),
th_por_ano as (
  select x.pessoa_id, jsonb_object_agg(x.ano::text, x.total) as horas_por_ano
  from (
    select
      pessoa_id,
      extract(year from data)::integer as ano,
      sum(total_horas_decimal)::numeric(12, 2) as total
    from public.timesheets
    where pessoa_id is not null and data is not null
    group by pessoa_id, extract(year from data)
  ) x
  group by x.pessoa_id
)
select
  p.id,
  p.ci,
  p.grupo_cliente,
  p.nome,
  p.cpf_cnpj,
  p.categoria,
  p.created_at,
  p.updated_at,
  coalesce(pc.qtd_processos, 0) as qtd_processos,
  coalesce(th.horas_total, 0)::numeric(12, 2) as horas_total,
  th2.horas_por_ano
from public.pessoas p
left join pc_count pc on pc.pessoa_id = p.id
left join th_total th on th.pessoa_id = p.id
left join th_por_ano th2 on th2.pessoa_id = p.id;

create view public.escritorio_empresas_por_grupo as
with grupo_from_processo as (
  select distinct on (pessoa_id)
    pessoa_id,
    trim(grupo_cliente) as grupo_from_pc
  from public.processos_completo
  where pessoa_id is not null
    and grupo_cliente is not null
    and trim(grupo_cliente) <> ''
  order by pessoa_id, updated_at desc
),
pc_count as (
  select pessoa_id, count(*)::integer as qtd_processos
  from public.processos_completo
  where pessoa_id is not null
  group by pessoa_id
),
th_total as (
  select pessoa_id, coalesce(sum(total_horas_decimal), 0)::numeric(12, 2) as horas_total
  from public.timesheets
  where pessoa_id is not null
  group by pessoa_id
),
th_por_ano as (
  select x.pessoa_id, jsonb_object_agg(x.ano::text, x.total) as horas_por_ano
  from (
    select
      pessoa_id,
      extract(year from data)::integer as ano,
      sum(total_horas_decimal)::numeric(12, 2) as total
    from public.timesheets
    where pessoa_id is not null and data is not null
    group by pessoa_id, extract(year from data)
  ) x
  group by x.pessoa_id
)
select
  p.id,
  p.ci,
  coalesce(nullif(trim(p.grupo_cliente), ''), gfp.grupo_from_pc) as grupo_cliente,
  p.nome,
  p.cpf_cnpj,
  p.categoria,
  p.created_at,
  p.updated_at,
  coalesce(pc.qtd_processos, 0) as qtd_processos,
  coalesce(th.horas_total, 0)::numeric(12, 2) as horas_total,
  th2.horas_por_ano
from public.pessoas p
left join grupo_from_processo gfp on gfp.pessoa_id = p.id
left join pc_count pc on pc.pessoa_id = p.id
left join th_total th on th.pessoa_id = p.id
left join th_por_ano th2 on th2.pessoa_id = p.id;

create view public.contagem_ci_por_grupo as
select
  md5(coalesce(grupo_cliente, '') || '-contagem') as id,
  coalesce(grupo_cliente, '') as grupo_cliente,
  count(*) filter (where lower(trim(situacao_processo)) = 'arquivado')::integer as arquivado,
  count(*) filter (
    where lower(trim(situacao_processo)) like '%arquivado definitivamente%'
       or lower(trim(situacao_processo)) = 'arquivado_definitivamente'
  )::integer as arquivado_definitivamente,
  count(*) filter (
    where lower(trim(situacao_processo)) like '%arquivado provisoriamente%'
       or lower(trim(situacao_processo)) = 'arquivado_provisoriamente'
  )::integer as arquivado_provisoriamente,
  count(*) filter (where lower(trim(situacao_processo)) = 'ativo')::integer as ativo,
  count(*) filter (
    where lower(trim(situacao_processo)) like '%encerrado%'
      and lower(trim(situacao_processo)) not like '%ex-cliente%'
      and lower(trim(situacao_processo)) not like '%ex cliente%'
  )::integer as encerrado,
  count(*) filter (
    where lower(trim(situacao_processo)) like '%ex-cliente%'
       or lower(trim(situacao_processo)) like '%ex cliente%'
       or lower(trim(situacao_processo)) = 'ex_cliente'
  )::integer as ex_cliente,
  count(*) filter (where lower(trim(situacao_processo)) = 'suspenso')::integer as suspenso,
  (
    count(*)
    - count(*) filter (where lower(trim(situacao_processo)) = 'arquivado')
    - count(*) filter (
        where lower(trim(situacao_processo)) like '%arquivado definitivamente%'
           or lower(trim(situacao_processo)) = 'arquivado_definitivamente'
      )
    - count(*) filter (
        where lower(trim(situacao_processo)) like '%arquivado provisoriamente%'
           or lower(trim(situacao_processo)) = 'arquivado_provisoriamente'
      )
    - count(*) filter (where lower(trim(situacao_processo)) = 'ativo')
    - count(*) filter (
        where lower(trim(situacao_processo)) like '%encerrado%'
          and lower(trim(situacao_processo)) not like '%ex-cliente%'
          and lower(trim(situacao_processo)) not like '%ex cliente%'
      )
    - count(*) filter (
        where lower(trim(situacao_processo)) like '%ex-cliente%'
           or lower(trim(situacao_processo)) like '%ex cliente%'
           or lower(trim(situacao_processo)) = 'ex_cliente'
      )
    - count(*) filter (where lower(trim(situacao_processo)) = 'suspenso')
  )::integer as outros,
  count(*)::integer as total_geral,
  max(updated_at) as created_at,
  max(updated_at) as updated_at
from public.processos_completo
group by grupo_cliente;

create view public.timesheets_resumo_por_grupo_ano as
select
  coalesce(grupo_cliente, '') as grupo_cliente,
  extract(year from data)::integer as ano,
  round(coalesce(sum(total_horas_decimal), 0), 2)::numeric(12, 2) as total_horas
from public.timesheets
where data is not null
group by grupo_cliente, extract(year from data);

create view public.escritorio_grupos_resumo as
with emp_count as (
  select
    coalesce(nullif(trim(grupo_cliente), ''), '') as grupo_cliente,
    count(*)::integer as total_empresas
  from public.escritorio_empresas_por_grupo
  group by coalesce(nullif(trim(grupo_cliente), ''), '')
),
th_sum as (
  select
    coalesce(nullif(trim(grupo_cliente), ''), '') as grupo_cliente,
    coalesce(sum(total_horas), 0)::numeric(12, 2) as horas_total
  from public.timesheets_resumo_por_grupo_ano
  group by coalesce(nullif(trim(grupo_cliente), ''), '')
)
select
  e.grupo_cliente,
  e.total_empresas,
  coalesce(c.total_geral, 0) as total_geral,
  coalesce(th.horas_total, 0)::numeric(12, 2) as horas_total
from emp_count e
left join public.contagem_ci_por_grupo c on c.grupo_cliente = e.grupo_cliente
left join th_sum th on th.grupo_cliente = e.grupo_cliente;

-- ── 9. Reuniões voltam a referenciar pessoa (cliente) por CI ──
alter table public.reunioes
  add constraint reunioes_cliente_id_fkey
  foreign key (cliente_id) references public.pessoas (ci) on delete set null;

create index if not exists idx_clientes_nome_lower on public.pessoas (lower(nome));

-- ── 10. RLS ──
alter table public.pessoas enable row level security;
alter table public.processos_completo enable row level security;
alter table public.timesheets enable row level security;

drop policy if exists "pessoas_vios_select" on public.pessoas;
create policy "pessoas_vios_select" on public.pessoas
  for select to authenticated using (true);

drop policy if exists "processos_completo_select" on public.processos_completo;
create policy "processos_completo_select" on public.processos_completo
  for select to authenticated using (true);

drop policy if exists "timesheets_vios_select" on public.timesheets;
create policy "timesheets_vios_select" on public.timesheets
  for select to authenticated using (true);
