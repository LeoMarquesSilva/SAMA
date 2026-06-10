-- SAMA — Migration 0003: campos para importação e fluxo de ativação/senha
--   departamento     → área/setor da pessoa (importado do CRM)
--   is_admin         → sócio fundador com acesso total
--   senha_provisoria → força troca de senha no primeiro acesso

alter table public.pessoas
  add column if not exists departamento     text,
  add column if not exists is_admin         boolean not null default false,
  add column if not exists senha_provisoria boolean not null default false;

create index if not exists idx_pessoas_is_admin on public.pessoas (is_admin);
