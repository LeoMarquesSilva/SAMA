-- SAMA — Permissões de categorização para SOCIO_AREA (não-admin).
-- SOCIO_AREA pode criar/editar reuniões próprias e categorizar eventos do próprio calendário Outlook.
-- is_admin é independente do cargo; apenas alguns devs têm is_admin=true com cargo SOCIO_AREA.

comment on function public.app_can_manage_reuniao(uuid) is
  'Admin ou criador (criado_por_id) pode gerenciar participantes da reunião.';

comment on function public.app_can_see_reuniao(uuid) is
  'Admin, participante, criador ou dono do evento Outlook vinculado pode ver a reunião.';

-- Reforço explícito: criador enxerga a própria reunião (INSERT … RETURNING).
drop policy if exists "reunioes_select_criador" on public.reunioes;
create policy "reunioes_select_criador" on public.reunioes
  for select to authenticated
  using (criado_por_id = public.app_pessoa_id());
