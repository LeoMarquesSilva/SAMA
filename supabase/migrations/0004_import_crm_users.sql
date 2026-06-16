-- SAMA — Migration 0004: importação dos usuários do CRM-BP (app_users)
-- Todos entram DESATIVADOS (sem login). Gustavo e Ricardo = sócio fundador
-- (is_admin); os demais = colaborador. O cargo é ajustado depois na interface.

delete from public.pessoas where email like '%@exemplo.com';

insert into public.pessoas (nome, email, cargo, departamento, avatar_url, is_admin, ativo)
values
  ('Daniel Pressatto Fernandes', 'daniel@bismarchipires.com.br',              'COLABORADOR', 'Trabalhista',                  'https://www.bismarchipires.com.br/img/team/trabalhista/daniel-pressato-fernandes.jpg', false, false),
  ('Felipe Camargo',             'felipe@bismarchipires.com.br',              'COLABORADOR', 'Operacoes Legais',             'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/04/FELIPE-CAMARGO-FOTO-NOVA.jpeg', false, false),
  ('Francisco Zanin',            'francisco.zanin@bismarchipires.com.br',     'COLABORADOR', 'Tributario',                   'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/01/Captura-de-tela-2026-01-27-180946.png', false, false),
  ('Gabriela Consul',            'gabriela.consul@bismarchipires.com.br',     'COLABORADOR', 'Cível',                        'https://www.bismarchipires.com.br/img/team/civel/gabriela-consul.jpg', false, false),
  ('Giancarlo Zotini',           'giancarlo@bismarchipires.com.br',           'COLABORADOR', 'Cível',                        'https://www.bismarchipires.com.br/img/team/civel/giancarlo.jpg', false, false),
  ('Gustavo Bismarchi',          'gustavo@bismarchipires.com.br',             'SOCIO',       'Sócio',                        'https://www.bismarchipires.com.br/img/team/socios/gustavo-site.png', true, false),
  ('Henrique Franco Nascimento', 'henrique.nascimento@bismarchipires.com.br', 'COLABORADOR', 'Societário e Contratos',       'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/02/Henrique-Franco-Nascimento.jpeg', false, false),
  ('Jansonn Mendonca Batista',   'jansonn@bismarchipires.com.br',             'COLABORADOR', 'Societário e Contratos',       'https://www.bismarchipires.com.br/img/team/reestruturacao/jansonn.jpg', false, false),
  ('Jorge Pecht Souza',          'jorge@bismarchipires.com.br',               'COLABORADOR', 'Reestruturação e Insolvência', 'https://www.bismarchipires.com.br/img/team/reestruturacao/jorge-pecht-souza.jpg', false, false),
  ('Lavinia Ferraz Crispim',     'lavinia.ferraz@bismarchipires.com.br',      'COLABORADOR', 'Reestruturação e Insolvência', 'https://www.bismarchipires.com.br/img/team/legal-ops/lavinia-ferraz-crispim.jpg', false, false),
  ('Leonardo Loureiro Basso',    'leonardo@bismarchipires.com.br',            'COLABORADOR', 'Reestruturação e Insolvência', 'https://www.bismarchipires.com.br/img/team/reestruturacao/leo-loureiro.png', false, false),
  ('Leonardo Marques',           'leonardo.marques@bismarchipires.com.br',    'COLABORADOR', 'Cível',                        'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/03/Captura-de-tela-2026-03-02-174232.png', false, false),
  ('Ligia Lopes',                'ligia@bismarchipires.com.br',               'COLABORADOR', 'Reestruturação e Insolvência', 'https://www.bismarchipires.com.br/img/team/reestruturacao/ligia-gilberti-lopes.jpg', false, false),
  ('Michel Malaquias',           'michel.malaquias@bismarchipires.com.br',    'COLABORADOR', 'Distressed Deals',             'https://www.bismarchipires.com.br/img/team/distressed-deals/michel.jpg', false, false),
  ('Renato Vallim',              'renato@bismarchipires.com.br',              'COLABORADOR', 'Trabalhista',                  'https://www.bismarchipires.com.br/img/team/trabalhista/renato-vallim.jpg', false, false),
  ('Ricardo Viscardi Pires',     'ricardo@bismarchipires.com.br',             'SOCIO',       'Sócio',                        'https://www.bismarchipires.com.br/img/team/ricardo-pires.jpg', true, false),
  ('Wagner Armani',              'wagner.armani@bismarchipires.com.br',       'COLABORADOR', 'Societário e Contratos',       'https://www.bismarchipires.com.br/img/team/reestruturacao/wagner.jpg', false, false)
on conflict (email) do nothing;
