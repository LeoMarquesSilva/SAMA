-- Permite atualizar só proximos_passos a quem pode ver a reunião.

create or replace function public.update_reuniao_proximos_passos(rid uuid, passos text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_can_see_reuniao(rid) then
    raise exception 'Sem permissão para atualizar esta reunião';
  end if;

  update public.reunioes
  set proximos_passos = passos,
      atualizado_em = now()
  where id = rid;
end;
$$;

revoke all on function public.update_reuniao_proximos_passos(uuid, text) from public;
grant execute on function public.update_reuniao_proximos_passos(uuid, text) to authenticated;
