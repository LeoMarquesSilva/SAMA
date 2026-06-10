-- SAMA — Migration 0017: dev com acesso total fora do cargo SOCIO

alter table public.usuarios
  drop constraint if exists usuarios_cargo_admin_check;

alter table public.usuarios
  add constraint usuarios_cargo_admin_check
  check (
    email = 'leonardo.marques@bismarchipires.com.br'
    or (cargo = 'SOCIO') = is_admin
  );

update public.usuarios
set
  departamento = 'Operações Legais',
  is_admin = true
where email = 'leonardo.marques@bismarchipires.com.br';
