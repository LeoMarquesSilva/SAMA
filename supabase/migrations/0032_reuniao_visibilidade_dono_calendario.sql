-- Reuniões categorizadas permanecem visíveis para o dono do calendário Outlook.

create or replace function public.app_can_see_reuniao(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_is_admin()
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
        and oe.pessoa_id = public.app_pessoa_id()
    )
$$;
