-- Cancelamento: reunião cancelada no SAMA cancela no VIOS o compromisso
-- "REUNIÃO / ATENDIMENTO AO CLIENTE" de cada responsável
-- (tela pxe/pxe-cancelar.php, tipo DESISTÊNCIA DO CLIENTE).
--
-- Mesmo ciclo da prorrogação (0054): a linha `operacao = 'cancelar'` fica
-- ligada à criação (`origem_id`) e só sai para o robô depois que a criação
-- terminou e tem CI. Nada sai para a mesma tarefa enquanto outra alteração
-- dela está com o robô.

alter table public.vios_agendamentos drop constraint if exists vios_agendamentos_operacao_check;
alter table public.vios_agendamentos
  add constraint vios_agendamentos_operacao_check
  check (operacao in ('criar', 'prorrogar', 'cancelar'));

-- Um cancelamento ativo por tarefa (se der erro, pode pedir de novo).
create unique index if not exists vios_agendamentos_cancelar_ativo_uq
  on public.vios_agendamentos (origem_id)
  where operacao = 'cancelar' and status <> 'erro';

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

  -- Alteração cuja criação falhou ou terminou sem CI: não há tarefa para alterar.
  update public.vios_agendamentos p
     set status = 'erro',
         erro = case
           when o.status = 'erro' then 'A criação da tarefa no VIOS falhou; não há o que alterar.'
           when p.operacao = 'cancelar' then 'CI da tarefa não identificado; cancele direto no VIOS.'
           else 'CI da tarefa não identificado; mude a data direto no VIOS.'
         end
    from public.vios_agendamentos o
   where p.operacao in ('prorrogar', 'cancelar')
     and p.status = 'pendente'
     and o.id = p.origem_id
     and (o.status = 'erro'
          or (o.status = 'concluido' and coalesce(o.resultado->>'ci_vios', '') = ''));

  -- Alteração pronta: CI da tarefa e, na prorrogação, a data que o VIOS deve
  -- estar mostrando (a da última prorrogação concluída ou, sem ela, a da criação).
  update public.vios_agendamentos p
     set ci_vios = o.resultado->>'ci_vios',
         data_anterior = case
           when p.operacao = 'prorrogar' then coalesce(
             (select u.data
                from public.vios_agendamentos u
               where u.origem_id = o.id
                 and u.operacao = 'prorrogar'
                 and u.status = 'concluido'
               order by u.atualizado_em desc
               limit 1),
             o.data)
         end
    from public.vios_agendamentos o
   where p.operacao in ('prorrogar', 'cancelar')
     and p.status = 'pendente'
     and o.id = p.origem_id
     and o.status = 'concluido'
     and coalesce(o.resultado->>'ci_vios', '') <> ''
     and not exists (
       select 1
         from public.vios_agendamentos x
        where x.origem_id = p.origem_id
          and x.operacao in ('prorrogar', 'cancelar')
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
                           and x.operacao in ('prorrogar', 'cancelar')
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
