-- SAMA — Migration 0036: correções de RLS
--
-- (1) vios_tarefas: a policy de SELECT (0028) expunha TODA tarefa concluída por
--     qualquer SOCIO_AREA a qualquer usuário autenticado — a condição testava o
--     cargo de QUEM CONCLUIU (usuario_concluiu_id) em vez do cargo do VISUALIZADOR.
--     Como praticamente todas as tarefas são concluídas por sócios de área, o
--     isolamento por linha ficava efetivamente desligado. Removemos a cláusula.
--     Cada usuário passa a ver apenas: as próprias tarefas (owner/concluidor) e
--     aquelas em que é responsável/auxiliar. Admin continua vendo tudo.
--
-- (2) reunioes_insert: o with_check `auth.uid() is not null` (0034) permitia que
--     qualquer autenticado inserisse reunião com `criado_por_id` arbitrário via
--     API direta. A UI já grava `criado_por_id` no servidor (service role), então
--     restringir o INSERT a si mesmo (ou admin) não altera o fluxo do app.

-- ─── (1) vios_tarefas_select ────────────────────────────────────────────────
drop policy if exists "vios_tarefas_select" on public.vios_tarefas;

create policy "vios_tarefas_select" on public.vios_tarefas
  for select to authenticated
  using (
    public.app_is_admin()
    or usuario_id = public.app_pessoa_id()
    or usuario_concluiu_id = public.app_pessoa_id()
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(vios_tarefas.responsaveis, '[]'::jsonb)
          || coalesce(vios_tarefas.auxiliares, '[]'::jsonb)
      ) as nome_el(nome)
      join public.usuarios u on u.id = public.app_pessoa_id()
      where lower(trim(nome_el.nome)) = lower(trim(u.nome))
    )
  );

-- ─── (2) reunioes_insert ────────────────────────────────────────────────────
drop policy if exists "reunioes_insert" on public.reunioes;

create policy "reunioes_insert" on public.reunioes
  for insert to authenticated
  with check (
    public.app_is_admin()
    or criado_por_id = public.app_pessoa_id()
  );
