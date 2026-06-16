-- Corrige URL da foto do Renato Vallim (arquivo antigo retorna 404).

update public.usuarios
set avatar_url = 'https://www.bismarchipires.com.br/img/team/trabalhista/renato-vallim.jpg'
where lower(email) = 'renato@bismarchipires.com.br';

update public.colaboradores
set avatar_url = 'https://www.bismarchipires.com.br/img/team/trabalhista/renato-vallim.jpg'
where lower(email) = 'renato@bismarchipires.com.br';
