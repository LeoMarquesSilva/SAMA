-- SAMA — Migration 0006: Fase 3 (Integração Outlook)

create table if not exists public.outlook_eventos (
  id                 uuid primary key default gen_random_uuid(),
  pessoa_id          uuid not null references public.pessoas (id) on delete cascade,
  outlook_event_id   text not null,
  titulo             text,
  inicio             timestamptz,
  fim                timestamptz,
  duracao_minutos    int,
  local              text,
  online             boolean not null default false,
  link_online        text,
  organizador_nome   text,
  organizador_email  text,
  participantes      jsonb not null default '[]'::jsonb,
  corpo_preview      text,
  status             text not null default 'PENDENTE'
                     check (status in ('PENDENTE','CATEGORIZADO_REUNIAO','CATEGORIZADO_ATIVIDADE','IGNORADO')),
  reuniao_id         uuid references public.reunioes (id) on delete set null,
  atividade_id       uuid references public.atividades_internas (id) on delete set null,
  categorizado_em    timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  unique (pessoa_id, outlook_event_id)
);

create index if not exists idx_outlook_status on public.outlook_eventos (status);
create index if not exists idx_outlook_pessoa on public.outlook_eventos (pessoa_id);
create index if not exists idx_outlook_inicio on public.outlook_eventos (inicio);

create trigger trg_outlook_eventos_atualizado_em
  before update on public.outlook_eventos
  for each row execute function public.set_atualizado_em();

create table if not exists public.outlook_sync_logs (
  id                uuid primary key default gen_random_uuid(),
  pessoa_id         uuid references public.pessoas (id) on delete set null,
  sincronizado_em   timestamptz not null default now(),
  eventos_importados int not null default 0,
  status            text not null,
  mensagem_erro     text
);

alter table public.outlook_eventos enable row level security;
alter table public.outlook_sync_logs enable row level security;

create policy "outlook_eventos_auth_all" on public.outlook_eventos
  for all to authenticated using (true) with check (true);
create policy "outlook_logs_auth_all" on public.outlook_sync_logs
  for all to authenticated using (true) with check (true);
