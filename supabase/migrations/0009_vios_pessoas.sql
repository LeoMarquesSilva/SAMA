-- SAMA — Migration 0009: espelho do relatório de clientes/pessoas do VIOS
-- Tabela separada da equipe interna (public.pessoas) e dos clientes do app (public.clientes).
-- Populada pelo script sync-vios-to-supabase via service_role (dual-write).

create table if not exists public.vios_pessoas (
  ci                    text primary key,
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
  atualizado_em         timestamptz not null default now()
);

create index if not exists idx_vios_pessoas_cnpj on public.vios_pessoas (cpf_cnpj);
create index if not exists idx_vios_pessoas_grupo on public.vios_pessoas (grupo_cliente);
create index if not exists idx_vios_pessoas_nome on public.vios_pessoas (nome);

alter table public.vios_pessoas enable row level security;

-- Leitura para usuários autenticados do app (escrita é via service_role, que ignora RLS).
create policy "vios_pessoas_select" on public.vios_pessoas
  for select to authenticated using (true);
