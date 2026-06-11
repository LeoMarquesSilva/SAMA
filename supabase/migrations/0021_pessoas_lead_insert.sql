-- SAMA — Permite criar leads de captação (não vêm do VIOS)

drop policy if exists "pessoas_lead_insert" on public.pessoas;
create policy "pessoas_lead_insert" on public.pessoas
  for insert to authenticated
  with check (
    ci like 'SAMA-LEAD-%'
    and categoria = 'CAPTAÇÃO'
  );
