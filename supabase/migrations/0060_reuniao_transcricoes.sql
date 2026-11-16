-- Transcrição das reuniões gravadas pelo Fellow, guardada no SAMA.
-- Até aqui o SAMA trazia do Fellow só o resumo e as ações; a conversa inteira ficava só lá.
-- Tabela à parte (e não uma coluna em reunioes) porque as listagens de reuniões usam
-- "select *" e uma transcrição tem dezenas de KB.
-- Quem grava é o servidor (service role): ao salvar uma reunião como Realizada e ao abrir
-- a ata de uma reunião que já aconteceu. Quem lê é quem pode ver a reunião (inclusive
-- a regra da ata trancada, via app_can_see_reuniao).

create table if not exists public.reuniao_transcricoes (
  reuniao_id uuid primary key references public.reunioes(id) on delete cascade,
  fellow_recording_id text,
  idioma text,
  gravacao_inicio timestamptz,
  gravacao_fim timestamptz,
  segmentos jsonb not null default '[]'::jsonb,
  importado_em timestamptz not null default now()
);

comment on table public.reuniao_transcricoes is
  'Transcrição da reunião gravada pelo Fellow (uma por reunião).';
comment on column public.reuniao_transcricoes.fellow_recording_id is
  'Id da gravação no Fellow (recordings.id).';
comment on column public.reuniao_transcricoes.segmentos is
  'Falas na ordem, como vêm do Fellow: [{start, end, speaker, text}], start/end em segundos desde o início da gravação.';

alter table public.reuniao_transcricoes enable row level security;

drop policy if exists "reuniao_transcricoes_select" on public.reuniao_transcricoes;
create policy "reuniao_transcricoes_select" on public.reuniao_transcricoes
  for select to authenticated
  using (public.app_can_see_reuniao(reuniao_id));
