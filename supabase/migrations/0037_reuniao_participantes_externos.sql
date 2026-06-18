-- SAMA — Migration 0037: participantes externos em reuniões
--
-- Até aqui reuniao_participantes só aceitava equipe interna (colaborador_id NOT NULL,
-- FK -> colaboradores). Convidados externos do invite do Outlook (clientes, parceiros)
-- eram descartados ao categorizar. Agora a tabela aceita externos identificados por
-- nome (e e-mail opcional, pois reuniões presenciais podem não ter e-mail).

alter table public.reuniao_participantes
  alter column colaborador_id drop not null;

alter table public.reuniao_participantes
  add column if not exists nome text,
  add column if not exists email text;

-- Toda linha precisa identificar alguém: colaborador interno OU um nome (externo).
alter table public.reuniao_participantes
  drop constraint if exists reuniao_participantes_identidade_chk;
alter table public.reuniao_participantes
  add constraint reuniao_participantes_identidade_chk
  check (
    colaborador_id is not null
    or nullif(btrim(coalesce(nome, '')), '') is not null
  );

comment on column public.reuniao_participantes.nome is
  'Nome do participante externo (quando colaborador_id é nulo).';
comment on column public.reuniao_participantes.email is
  'E-mail do participante externo (opcional).';
