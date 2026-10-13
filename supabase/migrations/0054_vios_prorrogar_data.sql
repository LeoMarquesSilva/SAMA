-- Prorrogação: quando a data muda no SAMA depois do agendamento, o robô muda a
-- data da tarefa que já existe no VIOS (tela pxe-obs.php&Prorrogar=true).
--
-- Uma prorrogação é outra linha da fila, ligada à criação pela `origem_id`.
-- Ela só sai para o robô depois que a criação terminou e tem o CI da tarefa.
-- `data_anterior` é a data que o SAMA espera encontrar no VIOS: se a tela
-- mostrar outra, o robô não grava (CI errado ou data mudada direto no VIOS).

alter table public.vios_agendamentos
  add column if not exists operacao      text not null default 'criar',
  add column if not exists origem_id     uuid references public.vios_agendamentos(id) on delete cascade,
  add column if not exists ci_vios       text,
  add column if not exists data_anterior text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vios_agendamentos_operacao_check') then
    alter table public.vios_agendamentos
      add constraint vios_agendamentos_operacao_check
      check (operacao in ('criar', 'prorrogar'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vios_agendamentos_prorrogar_origem_check') then
    alter table public.vios_agendamentos
      add constraint vios_agendamentos_prorrogar_origem_check
      check (operacao = 'criar' or origem_id is not null);
  end if;
end $$;

create index if not exists vios_agendamentos_origem_idx
  on public.vios_agendamentos (origem_id, criado_em desc)
  where origem_id is not null;

-- No máximo uma prorrogação esperando por tarefa: mudar de novo só troca a data dela.
create unique index if not exists vios_agendamentos_prorrogar_pendente_uq
  on public.vios_agendamentos (origem_id)
  where operacao = 'prorrogar' and status = 'pendente';

create or replace function public.vios_agendamentos_reservar(p_limite int default 5)
returns setof public.vios_agendamentos
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vios_agendamentos
     set status = 'erro',
         erro = 'Execução interrompida (RPA reiniciou ou travou). Conferir manualmente no VIOS antes de reenviar.'
   where status = 'processando'
     and atualizado_em < now() - interval '30 minutes';

  update public.vios_agendamentos
     set status = 'erro',
         erro = coalesce(erro, 'Excedeu 3 tentativas de envio ao RPA.')
   where status = 'enviado'
     and atualizado_em < now() - interval '30 minutes'
     and tentativas >= 3;

  -- Prorrogação cuja criação falhou ou terminou sem CI: não há tarefa para alterar.
  update public.vios_agendamentos p
     set status = 'erro',
         erro = case
           when o.status = 'erro' then 'A criação da tarefa no VIOS falhou; não há data para prorrogar.'
           else 'CI da tarefa não identificado; mude a data direto no VIOS.'
         end
    from public.vios_agendamentos o
   where p.operacao = 'prorrogar'
     and p.status = 'pendente'
     and o.id = p.origem_id
     and (o.status = 'erro'
          or (o.status = 'concluido' and coalesce(o.resultado->>'ci_vios', '') = ''));

  -- Prorrogação pronta: CI da tarefa e a data que o VIOS deve estar mostrando
  -- (a da última prorrogação concluída ou, sem ela, a da criação).
  update public.vios_agendamentos p
     set ci_vios = o.resultado->>'ci_vios',
         data_anterior = coalesce(
           (select u.data
              from public.vios_agendamentos u
             where u.origem_id = o.id
               and u.operacao = 'prorrogar'
               and u.status = 'concluido'
             order by u.atualizado_em desc
             limit 1),
           o.data)
    from public.vios_agendamentos o
   where p.operacao = 'prorrogar'
     and p.status = 'pendente'
     and o.id = p.origem_id
     and o.status = 'concluido'
     and coalesce(o.resultado->>'ci_vios', '') <> ''
     and not exists (
       select 1
         from public.vios_agendamentos x
        where x.origem_id = p.origem_id
          and x.operacao = 'prorrogar'
          and x.status in ('enviado', 'processando'));

  return query
  update public.vios_agendamentos a
     set status = 'enviado',
         tentativas = a.tentativas + 1,
         erro = null
   where a.id in (
     select v.id
       from public.vios_agendamentos v
      where (v.status = 'pendente'
             and (v.operacao = 'criar'
                  or (v.ci_vios is not null
                      and not exists (
                        select 1
                          from public.vios_agendamentos x
                         where x.origem_id = v.origem_id
                           and x.operacao = 'prorrogar'
                           and x.status in ('enviado', 'processando')))))
         or (v.status = 'enviado'
             and v.atualizado_em < now() - interval '30 minutes'
             and v.tentativas < 3)
      order by v.criado_em
      limit greatest(p_limite, 1)
      for update skip locked
   )
  returning a.*;
end $$;

revoke all on function public.vios_agendamentos_reservar(int) from public, anon, authenticated;
grant execute on function public.vios_agendamentos_reservar(int) to service_role;
