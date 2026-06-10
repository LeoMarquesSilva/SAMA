-- SAMA — Migration 0016: is_admin segue o cargo (SOCIO = acesso total)

update public.usuarios
set is_admin = (cargo = 'SOCIO');

alter table public.usuarios
  add constraint usuarios_cargo_admin_check
  check ((cargo = 'SOCIO') = is_admin);
