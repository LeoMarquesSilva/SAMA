-- SAMA — Migration 0015: renomeia cargo GERENTE_AREA → SOCIO_AREA

alter table public.usuarios
  drop constraint pessoas_cargo_check;

update public.usuarios
set cargo = 'SOCIO_AREA'
where cargo = 'GERENTE_AREA';

alter table public.usuarios
  add constraint usuarios_cargo_check
  check (cargo in ('SOCIO', 'SOCIO_AREA', 'COLABORADOR'));
