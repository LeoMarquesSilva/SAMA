-- SAMA — Migration 0005: Fase 2 (Reuniões, Atividades Internas, Timesheet)

-- ─── REUNIÕES EXTERNAS ──────────────────────────────────────────────────────
create table if not exists public.reunioes (
  id                  uuid primary key default gen_random_uuid(),
  outlook_event_id    text unique,
  titulo              text not null,
  tipo                text not null check (tipo in ('CAPTACAO','FIDELIZACAO','RELACIONAMENTO')),
  status              text not null default 'AGENDADA' check (status in ('AGENDADA','REALIZADA','CANCELADA','REAGENDADA')),
  data_hora_inicio    timestamptz not null,
  data_hora_fim       timestamptz,
  duracao_minutos     int,
  modalidade          text not null check (modalidade in ('PRESENCIAL_ESCRITORIO','PRESENCIAL_EXTERNO','ONLINE')),
  link_online         text,
  local               text,
  cliente_id          uuid references public.clientes (id) on delete set null,
  criado_por_id       uuid references public.pessoas (id) on delete set null,
  tema                text,
  objetivos           text,
  resultado           text,
  proximos_passos     text,
  gravacao_url        text,
  ata_texto           text,
  ata_arquivo_url     text,
  motivo_cancelamento text,
  cancelado_em        timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_reunioes_tipo on public.reunioes (tipo);
create index if not exists idx_reunioes_status on public.reunioes (status);
create index if not exists idx_reunioes_inicio on public.reunioes (data_hora_inicio);
create index if not exists idx_reunioes_cliente on public.reunioes (cliente_id);

create trigger trg_reunioes_atualizado_em
  before update on public.reunioes
  for each row execute function public.set_atualizado_em();

-- ─── PARTICIPANTES DA REUNIÃO ───────────────────────────────────────────────
create table if not exists public.reuniao_participantes (
  id          uuid primary key default gen_random_uuid(),
  reuniao_id  uuid not null references public.reunioes (id) on delete cascade,
  pessoa_id   uuid not null references public.pessoas (id) on delete cascade,
  papel       text not null default 'PARTICIPANTE' check (papel in ('ORGANIZADOR','PARTICIPANTE')),
  confirmado  boolean not null default false,
  unique (reuniao_id, pessoa_id)
);

create index if not exists idx_participantes_reuniao on public.reuniao_participantes (reuniao_id);
create index if not exists idx_participantes_pessoa on public.reuniao_participantes (pessoa_id);

-- ─── ATIVIDADES INTERNAS ────────────────────────────────────────────────────
create table if not exists public.atividades_internas (
  id                  uuid primary key default gen_random_uuid(),
  outlook_event_id    text unique,
  tipo                text not null check (tipo in ('DESPACHO','REVISAO_PECA','REUNIAO_INTERNA','REUNIAO_GESTAO','UM_A_UM','OUTROS')),
  titulo              text not null,
  descricao           text,
  tema                text,
  data_hora_inicio    timestamptz not null,
  data_hora_fim       timestamptz,
  duracao_minutos     int,
  pessoa_id           uuid not null references public.pessoas (id) on delete cascade,
  com_pessoa_nome     text,
  com_pessoa_id       uuid references public.pessoas (id) on delete set null,
  status              text not null default 'REALIZADA' check (status in ('REALIZADA','CANCELADA')),
  motivo_cancelamento text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_atividades_tipo on public.atividades_internas (tipo);
create index if not exists idx_atividades_pessoa on public.atividades_internas (pessoa_id);
create index if not exists idx_atividades_inicio on public.atividades_internas (data_hora_inicio);

create trigger trg_atividades_atualizado_em
  before update on public.atividades_internas
  for each row execute function public.set_atualizado_em();

-- ─── TIMESHEET ──────────────────────────────────────────────────────────────
create table if not exists public.timesheet_entradas (
  id                   uuid primary key default gen_random_uuid(),
  pessoa_id            uuid not null references public.pessoas (id) on delete cascade,
  atividade_interna_id uuid unique references public.atividades_internas (id) on delete cascade,
  data                 timestamptz not null,
  duracao_minutos      int not null default 0,
  descricao            text,
  categoria            text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create index if not exists idx_timesheet_pessoa on public.timesheet_entradas (pessoa_id);
create index if not exists idx_timesheet_data on public.timesheet_entradas (data);

create trigger trg_timesheet_atualizado_em
  before update on public.timesheet_entradas
  for each row execute function public.set_atualizado_em();

-- ─── TRIGGER: timesheet automático a partir da atividade interna ─────────────
create or replace function public.sync_timesheet()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.timesheet_entradas
      (pessoa_id, atividade_interna_id, data, duracao_minutos, descricao, categoria)
    values (
      new.pessoa_id, new.id, new.data_hora_inicio,
      case when new.status = 'CANCELADA' then 0 else coalesce(new.duracao_minutos, 0) end,
      new.titulo, new.tipo
    );
  elsif (tg_op = 'UPDATE') then
    update public.timesheet_entradas set
      pessoa_id = new.pessoa_id,
      data = new.data_hora_inicio,
      duracao_minutos = case when new.status = 'CANCELADA' then 0 else coalesce(new.duracao_minutos, 0) end,
      descricao = new.titulo,
      categoria = new.tipo
    where atividade_interna_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_atividade_timesheet
  after insert or update on public.atividades_internas
  for each row execute function public.sync_timesheet();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.reunioes enable row level security;
alter table public.reuniao_participantes enable row level security;
alter table public.atividades_internas enable row level security;
alter table public.timesheet_entradas enable row level security;

create policy "reunioes_auth_all" on public.reunioes
  for all to authenticated using (true) with check (true);
create policy "participantes_auth_all" on public.reuniao_participantes
  for all to authenticated using (true) with check (true);
create policy "atividades_auth_all" on public.atividades_internas
  for all to authenticated using (true) with check (true);
create policy "timesheet_auth_all" on public.timesheet_entradas
  for all to authenticated using (true) with check (true);
