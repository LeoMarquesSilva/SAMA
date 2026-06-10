-- SAMA — Migration 0008: hardening de funções (avisos do linter de segurança)

-- Fixa search_path das funções de gatilho.
alter function public.set_atualizado_em() set search_path = public;
alter function public.sync_timesheet() set search_path = public;

-- Funções auxiliares de RLS não devem ser chamáveis por usuários anônimos.
-- Mantém EXECUTE para 'authenticated' (necessário para o RLS funcionar).
revoke execute on function public.app_pessoa_id() from anon, public;
revoke execute on function public.app_is_admin() from anon, public;
revoke execute on function public.app_can_see_reuniao(uuid) from anon, public;
grant execute on function public.app_pessoa_id() to authenticated;
grant execute on function public.app_is_admin() to authenticated;
grant execute on function public.app_can_see_reuniao(uuid) to authenticated;
