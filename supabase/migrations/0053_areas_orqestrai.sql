-- Área do usuário = área do ORQESTRAI (departamento do colaborador vinculado).
-- É por ela que o agendamento acha a pasta da área (reuniao_pastas_area) e que
-- a agenda dos colegas da mesma área fica visível (app_mesmo_departamento).
-- Antes o cadastro de usuários tinha nomes próprios ("Reestruturação e
-- Insolvência", "Societário e Contratos") e áreas desatualizadas.
-- Sócio fundador (cargo SOCIO + departamento Sócio) mantém "Sócio".
-- Daqui em diante o sync de colaboradores mantém o alinhamento.

update public.usuarios u
set departamento = c.departamento
from public.colaboradores c
where c.usuario_id = u.id
  and c.orqestrai_id is not null
  and c.ativo
  and nullif(trim(c.departamento), '') is not null
  and u.desativado_em is null
  and u.departamento is distinct from c.departamento
  and not (u.cargo = 'SOCIO' and u.departamento = 'Sócio');

-- Nomes antigos que sobraram (ex.: usuários desativados).
update public.usuarios set departamento = 'Reestruturação'
  where departamento = 'Reestruturação e Insolvência';
update public.usuarios set departamento = 'Contratos'
  where departamento = 'Societário e Contratos';
