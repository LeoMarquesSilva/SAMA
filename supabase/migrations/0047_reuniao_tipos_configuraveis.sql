-- SAMA/ECOA — Tipos de classificação de reunião administráveis em Configurações.
-- Sai o CHECK fixo em reunioes.tipo e entra uma tabela com FK, para dar/alterar
-- tipo e descrição pela interface sem precisar de deploy.

-- ─── Tabela ──────────────────────────────────────────────────────────────────
create table if not exists public.reuniao_tipos (
  chave         text primary key,
  label         text not null,
  descricao     text not null default '',
  -- ativo = oferecido ao classificar reunião nova. Tipo aposentado fica inativo,
  -- mas continua aqui para o histórico não perder o nome.
  ativo         boolean not null default true,
  -- preenche o cliente automaticamente com o grupo interno do escritório
  grupo_interno boolean not null default false,
  cor           text,
  ordem         int not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reuniao_tipos_chave_formato'
  ) then
    alter table public.reuniao_tipos
      add constraint reuniao_tipos_chave_formato
      check (chave ~ '^[A-Z0-9_]{2,40}$');
  end if;
end $$;

drop trigger if exists trg_reuniao_tipos_atualizado_em on public.reuniao_tipos;
create trigger trg_reuniao_tipos_atualizado_em
  before update on public.reuniao_tipos
  for each row execute function public.set_atualizado_em();

-- ─── Semente: os tipos que já existiam no código ─────────────────────────────
-- ativo só nos três em uso; os demais ficam inativos, preservando as reuniões
-- já classificadas com eles.
insert into public.reuniao_tipos (chave, label, descricao, ativo, grupo_interno, cor, ordem)
values
  ('GESTAO_OPERACIONAL', 'Operacional',
   'Reuniões destinadas à discussão de casos, processos, operações, demandas específicas de clientes, alinhamentos técnicos ou operacionais, definição de estratégias processuais e acompanhamento da execução das atividades.',
   true, true, '#ef4444', 10),
  ('CAPTACAO', 'Captação / Cross-selling',
   'Reuniões voltadas à geração de receita nova: prospecção de potenciais clientes, parceiros e contatos estratégicos, e também a oferta de outras áreas do escritório a clientes que já são da casa (cross-selling). Inclui apresentação institucional, levantamento de necessidades e desdobramentos que possam resultar em nova contratação de serviços.',
   true, false, '#101f2e', 20),
  ('RELACIONAMENTO_INSTITUCIONAL', 'Relacionamento institucional',
   'Reuniões destinadas à construção e manutenção de relacionamentos estratégicos com autoridades, entidades de classe, associações, parceiros institucionais, formadores de opinião e demais stakeholders relevantes para o posicionamento do escritório.',
   true, false, '#f59e0b', 30),
  ('FIDELIZACAO', 'Fidelização',
   'Reuniões com clientes e Consultores ativos, voltadas ao fortalecimento do relacionamento, acompanhamento da satisfação, identificação de novas demandas e ampliação da parceria entre cliente e escritório.',
   false, false, '#10b981', 40),
  ('GESTAO_ESTRATEGICA', 'Gestão Estratégica',
   'Reuniões entre sócios, gestores ou lideranças destinadas à discussão de temas estratégicos, resultados, indicadores, planejamento, governança, orçamento, projetos e direcionamento do escritório.',
   false, false, '#8b5cf6', 50),
  ('GESTAO_EQUIPE', 'Gestão de Equipe',
   'Reuniões voltadas à liderança e desenvolvimento de pessoas, incluindo one a ones, feedbacks, acompanhamento de desempenho, alinhamentos de equipe, PDIs e temas relacionados à gestão de colaboradores.',
   false, true, '#64748b', 60),
  ('EVENTOS_PALESTRAS', 'Eventos e Palestras',
   'Participação em congressos, seminários, palestras, workshops, treinamentos e demais eventos voltados à atualização técnica, desenvolvimento profissional, compartilhamento de conhecimento e ampliação de networking.',
   false, false, '#06b6d4', 70)
on conflict (chave) do nothing;

-- Qualquer tipo que exista em reunioes e não esteja na semente entra inativo,
-- senão a FK abaixo falharia e o histórico ficaria sem rótulo.
insert into public.reuniao_tipos (chave, label, descricao, ativo, ordem)
select distinct r.tipo, r.tipo, '', false, 900
  from public.reunioes r
 where r.tipo is not null
   and not exists (select 1 from public.reuniao_tipos t where t.chave = r.tipo)
on conflict (chave) do nothing;

-- ─── reunioes.tipo: CHECK fixo sai, FK entra ─────────────────────────────────
alter table public.reunioes drop constraint if exists reunioes_tipo_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reunioes_tipo_fkey'
  ) then
    alter table public.reunioes
      add constraint reunioes_tipo_fkey
      foreign key (tipo) references public.reuniao_tipos (chave)
      on update cascade;
  end if;
end $$;

create index if not exists idx_reunioes_tipo_fk on public.reunioes (tipo);

-- ─── RLS: todos leem, só admin escreve ───────────────────────────────────────
alter table public.reuniao_tipos enable row level security;

drop policy if exists reuniao_tipos_select on public.reuniao_tipos;
create policy reuniao_tipos_select on public.reuniao_tipos
  for select to authenticated using (true);

drop policy if exists reuniao_tipos_write on public.reuniao_tipos;
create policy reuniao_tipos_write on public.reuniao_tipos
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

-- ─── Módulo novo: Configurações ──────────────────────────────────────────────
alter table public.usuario_modulos drop constraint if exists usuario_modulos_modulo_check;
alter table public.usuario_modulos
  add constraint usuario_modulos_modulo_check
  check (modulo in (
    'dashboard',
    'calendario',
    'proximos-passos',
    'ajuda',
    'timesheet',
    'usuarios',
    'clientes',
    'relatorios',
    'tarefas',
    'configuracoes'
  ));
