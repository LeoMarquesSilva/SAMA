-- Síntese do processo: a vistagem do Orquestra pede para acrescentar um parágrafo
-- à "Observações (Síntese do processo)" da pasta no VIOS (cadastro do processo,
-- campo form[obs_proc]). O robô junta o parágrafo no fim, sem mexer no resto.
--
-- A linha da fila tem operacao = 'sintese', ci_pasta = CI da pasta, observacao =
-- o texto acrescentado, responsavel = quem pediu e data = o dia do pedido (o robô
-- escreve "dd/mm/aaaa (Nome): texto").
--
-- É a última prioridade do robô: a reserva só manda uma síntese por vez e só quando
-- não há nada enviado, rodando ou pronto para sair (agendar, prorrogar, cancelar).

alter table public.vios_agendamentos drop constraint if exists vios_agendamentos_operacao_check;
alter table public.vios_agendamentos
  add constraint vios_agendamentos_operacao_check
  check (operacao in ('criar', 'prorrogar', 'cancelar', 'sintese'));

-- A síntese não nasce de uma tarefa criada: não tem origem_id.
alter table public.vios_agendamentos drop constraint if exists vios_agendamentos_prorrogar_origem_check;
alter table public.vios_agendamentos
  add constraint vios_agendamentos_prorrogar_origem_check
  check (operacao in ('criar', 'sintese') or origem_id is not null);

alter table public.vios_agendamentos drop constraint if exists vios_agendamentos_sintese_check;
alter table public.vios_agendamentos
  add constraint vios_agendamentos_sintese_check
  check (operacao <> 'sintese' or (coalesce(ci_pasta, '') ~ '^[0-9]+$' and btrim(observacao) <> ''));

-- O Orquestra lista as sínteses pedidas de cada pasta.
create index if not exists vios_agendamentos_sintese_ci_idx
  on public.vios_agendamentos (ci_pasta, criado_em desc)
  where operacao = 'sintese';

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
                  or (v.operacao in ('prorrogar', 'cancelar')
                      and v.ci_vios is not null
                      and not exists (
                        select 1
                          from public.vios_agendamentos x
                         where x.origem_id = v.origem_id
                           and x.operacao in ('prorrogar', 'cancelar')
                           and x.status in ('enviado', 'processando')))))
         -- Síntese: a mais antiga, só com o robô parado (nada enviado ou rodando)
         -- e nenhuma outra linha pronta para sair.
         or (v.status = 'pendente'
             and v.operacao = 'sintese'
             and v.id = (
               select s.id
                 from public.vios_agendamentos s
                where s.status = 'pendente'
                  and s.operacao = 'sintese'
                order by s.criado_em
                limit 1)
             and not exists (
               select 1
                 from public.vios_agendamentos y
                where y.status in ('enviado', 'processando'))
             and not exists (
               select 1
                 from public.vios_agendamentos y
                where y.status = 'pendente'
                  and (y.operacao = 'criar'
                       or (y.operacao in ('prorrogar', 'cancelar') and y.ci_vios is not null))))
         or (v.status = 'enviado'
             and v.atualizado_em < now() - interval '30 minutes'
             and v.tentativas < 3)
      order by (v.operacao = 'sintese'), v.criado_em
      limit greatest(p_limite, 1)
      for update skip locked
   )
  returning a.*;
end $$;

revoke all on function public.vios_agendamentos_reservar(int) from public, anon, authenticated;
grant execute on function public.vios_agendamentos_reservar(int) to service_role;
