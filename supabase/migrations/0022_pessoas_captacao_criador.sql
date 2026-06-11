-- SAMA — Leads de captação: criador, categoria CAPTAÇÃO

alter table public.pessoas
  add column if not exists criado_por_usuario_id uuid
  references public.usuarios (id) on delete set null;

create index if not exists idx_pessoas_criado_por
  on public.pessoas (criado_por_usuario_id);

update public.pessoas
set categoria = 'CAPTAÇÃO'
where ci like 'SAMA-LEAD-%' and (categoria is null or categoria = 'Lead');

drop policy if exists "pessoas_lead_insert" on public.pessoas;
create policy "pessoas_lead_insert" on public.pessoas
  for insert to authenticated
  with check (
    ci like 'SAMA-LEAD-%'
    and categoria = 'CAPTAÇÃO'
    and criado_por_usuario_id is not null
  );
