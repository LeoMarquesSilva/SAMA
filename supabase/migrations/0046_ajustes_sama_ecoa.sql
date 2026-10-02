-- SAMA/ECOA — Ajustes de outubro/2026
--  1. Marcador de desativação: desativado sai das seleções do sistema.
--  2. Remove o acesso do usuário Jorge (saiu do escritório).
--  3. Visão 360º: coluna visao_global libera os dados dos demais usuários.
--  4. Reuniões: classificação da demanda (Insolvência / Cível / ambas).
--  5. Reuniões: ata/reunião trancada — visível só para gestores da área.

-- ─── 1. Marcador de desativação ──────────────────────────────────────────────
-- `ativo` quer dizer "tem login no SAMA", e a maior parte da equipe nunca foi
-- ativada (a migration 0004 entrou toda com ativo = false). Então `ativo` não
-- serve para esconder gente das seleções: some colega e some dado de quem já
-- tem reunião, tarefa e timesheet. Quem foi desativado de propósito ganha data.
alter table public.usuarios
  add column if not exists desativado_em timestamptz;

comment on column public.usuarios.desativado_em is
  'Quando o acesso foi desativado de propósito. Preenchido = sai das seleções do sistema.';

-- ─── 2. Tirar o Jorge do sistema ─────────────────────────────────────────────
-- Sem DELETE de propósito: por causa do rename em 0012, as FKs de
-- atividades_internas, timesheet_entradas, outlook_eventos e
-- reuniao_participantes apontam para usuarios com ON DELETE CASCADE. Apagar a
-- linha levaria embora o histórico de atividades e o timesheet dele.
-- Revogar o login + marcar desativado tira o acesso e tira das seleções,
-- preservando o que já foi lançado. O login no Supabase Auth é apagado pelo app
-- (desativarPessoa) ou no painel de Authentication.
update public.usuarios
  set ativo = false,
      senha_provisoria = false,
      auth_user_id = null,
      desativado_em = coalesce(desativado_em, now())
  where email = 'jorge@bismarchipires.com.br';

delete from public.usuario_modulos
  where usuario_id in (
    select id from public.usuarios where email = 'jorge@bismarchipires.com.br'
  );

update public.colaboradores
  set usuario_id = null
  where usuario_id in (
    select id from public.usuarios where email = 'jorge@bismarchipires.com.br'
  );

-- ─── 3. Visão 360º (acesso aos dados dos demais usuários) ────────────────────
alter table public.usuarios
  add column if not exists visao_global boolean not null default false;

comment on column public.usuarios.visao_global is
  'Visão 360º: vê agendas, reuniões e atividades de todos, sem ser admin.';

-- Compara só a parte antes do @: o escritório usa dois domínios
-- (@bismarchipires.com.br e @bpplaw.com.br) e a mesma pessoa aparece nos dois.
-- Ligia Gilberti Lopes ainda não tinha cadastro em usuarios quando isto rodou
-- (existe só em colaboradores); ao criar o acesso dela, rodar este update de novo.
update public.usuarios
  set visao_global = true
  where split_part(lower(email), '@', 1) in (
    'ligia',            -- Ligia Gilberti Lopes
    'lavinia.ferraz',   -- Lavinia Ferraz Crispim
    'leonardo',         -- Leonardo Loureiro Basso
    'leonardo.marques'  -- Leonardo Marques Silva
  );

create or replace function public.app_tem_visao_global()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select visao_global from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  )
$$;

create or replace function public.app_pode_ver_todas_agendas()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin()
    or public.app_is_socio()
    or public.app_tem_visao_global()
$$;

-- ─── 4. Classificação da demanda + trava de visualização ─────────────────────
alter table public.reunioes
  add column if not exists demanda text,
  add column if not exists ata_restrita boolean not null default false;

comment on column public.reunioes.demanda is
  'Classificação da demanda: INSOLVENCIA, CIVEL ou INSOLVENCIA_CIVEL.';
comment on column public.reunioes.ata_restrita is
  'Trancada: ata/reunião visível só para os gestores da área e para o criador.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reunioes_demanda_check'
  ) then
    alter table public.reunioes
      add constraint reunioes_demanda_check
      check (demanda is null or demanda in ('INSOLVENCIA', 'CIVEL', 'INSOLVENCIA_CIVEL'));
  end if;
end $$;

-- ─── 5. Quem é gestor da área ────────────────────────────────────────────────
/** Sócio ou sócio de área do mesmo departamento do usuário `uid`. */
create or replace function public.app_is_gestor_da_area(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.usuarios eu
    join public.usuarios alvo on alvo.id = uid
    where eu.auth_user_id = auth.uid()
      and eu.cargo in ('SOCIO', 'SOCIO_AREA')
      and eu.departamento is not null
      and eu.departamento = alvo.departamento
  )
$$;

-- Reunião trancada: só visão global, gestor da área do criador ou o próprio criador.
create or replace function public.app_can_see_reuniao(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce(
      (select r.ata_restrita from public.reunioes r where r.id = rid),
      false
    ) then
      public.app_pode_ver_todas_agendas()
        or exists (
          select 1 from public.reunioes r
          where r.id = rid
            and (
              r.criado_por_id = public.app_pessoa_id()
              or public.app_is_gestor_da_area(r.criado_por_id)
            )
        )
    else
      public.app_pode_ver_todas_agendas()
        or exists (
          select 1
          from public.reuniao_participantes rp
          join public.colaboradores c on c.id = rp.colaborador_id
          where rp.reuniao_id = rid
            and c.usuario_id = public.app_pessoa_id()
        )
        or exists (
          select 1 from public.reunioes r
          where r.id = rid and r.criado_por_id = public.app_pessoa_id()
        )
        or exists (
          select 1 from public.outlook_eventos oe
          where oe.reuniao_id = rid
            and public.app_pode_ver_agenda_de(oe.pessoa_id)
        )
        or exists (
          select 1
          from public.reunioes r
          join public.usuarios u on u.id = r.criado_por_id
          where r.id = rid
            and public.app_mesmo_departamento(u.id)
        )
  end
$$;

-- `reunioes_select_criador` é OR com `reunioes_select`: mantém o criador na
-- reunião trancada e não vaza as demais.

revoke execute on function public.app_tem_visao_global() from anon, public;
revoke execute on function public.app_is_gestor_da_area(uuid) from anon, public;
grant execute on function public.app_tem_visao_global() to authenticated;
grant execute on function public.app_is_gestor_da_area(uuid) to authenticated;
