-- SAMA — Migration 0018: segurança (senha, logs) + Realtime

-- ── Troca de senha: usuário atualiza só senha_provisoria na própria linha ──
create or replace function public.clear_senha_provisoria()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usuarios
  set senha_provisoria = false
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado para este login.';
  end if;
end;
$$;

revoke all on function public.clear_senha_provisoria() from public;
grant execute on function public.clear_senha_provisoria() to authenticated;

-- ── Outlook sync logs: somente admin ──
drop policy if exists "outlook_logs_all" on public.outlook_sync_logs;
create policy "outlook_logs_admin" on public.outlook_sync_logs
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

-- ── Remove exceção hardcoded por e-mail (dev usa is_admin explícito) ──
alter table public.usuarios
  drop constraint if exists usuarios_cargo_admin_check;

-- ── Realtime: tabelas colaborativas ──
do $$
begin
  alter publication supabase_realtime add table public.outlook_eventos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reunioes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reuniao_participantes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.atividades_internas;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.timesheet_entradas;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.usuarios;
exception when duplicate_object then null;
end $$;
