-- SAMA — Admin explícito: cargo SOCIO não implica mais is_admin automaticamente

alter table public.usuarios
  drop constraint if exists usuarios_cargo_admin_check;
