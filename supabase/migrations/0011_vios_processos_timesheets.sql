-- SAMA — Migration 0011: espelhos do VIOS (processos e timesheets), exceto financeiro.
-- Tabelas separadas das do app (clientes/pessoas/timesheet_entradas). Escrita via service_role.

-- ── Processos Completo ──
create table if not exists public.vios_processos_completo (
  ci                    text primary key,
  grupo_cliente         text,
  departamento          text,
  area                  text,
  advogado_responsavel  text,
  cliente               text,
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
  atualizado_em         timestamptz not null default now()
);
create index if not exists idx_vios_proc_cliente on public.vios_processos_completo (cliente);
create index if not exists idx_vios_proc_grupo on public.vios_processos_completo (grupo_cliente);
create index if not exists idx_vios_proc_situacao on public.vios_processos_completo (situacao_processo);

-- ── TimeSheets (horas do VIOS — diferente do timesheet_entradas do app) ──
create table if not exists public.vios_timesheets (
  ci                      text primary key,
  data                    date,
  cobrar                  text,
  grupo_cliente           text,
  cliente                 text,
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
  atualizado_em           timestamptz not null default now()
);
create index if not exists idx_vios_ts_cliente on public.vios_timesheets (cliente);
create index if not exists idx_vios_ts_colaborador on public.vios_timesheets (colaborador);
create index if not exists idx_vios_ts_data on public.vios_timesheets (data);

-- RLS: leitura para autenticados; escrita via service_role (ignora RLS).
alter table public.vios_processos_completo enable row level security;
alter table public.vios_timesheets enable row level security;

create policy "vios_proc_select" on public.vios_processos_completo
  for select to authenticated using (true);
create policy "vios_ts_select" on public.vios_timesheets
  for select to authenticated using (true);

create trigger trg_vios_proc_atualizado_em
  before update on public.vios_processos_completo
  for each row execute function public.set_atualizado_em();
create trigger trg_vios_ts_atualizado_em
  before update on public.vios_timesheets
  for each row execute function public.set_atualizado_em();
