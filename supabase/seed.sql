-- ════════════════════════════════════════════════════════════════════════════
-- SAMA — Seed de dados de exemplo (Fase 1)
-- ════════════════════════════════════════════════════════════════════════════
-- Rode após a migration 0001. Para o login funcionar, crie o usuário de auth
-- correspondente em Authentication > Users no painel do Supabase (ou via API)
-- usando o mesmo e-mail.

insert into public.pessoas (nome, email, cargo) values
  ('Ana Sócia',        'ana.socia@exemplo.com',      'SOCIO'),
  ('Bruno Gerente',    'bruno.gerente@exemplo.com',  'SOCIO_AREA'),
  ('Carla Colaboradora','carla.colab@exemplo.com',   'COLABORADOR')
on conflict (email) do nothing;

insert into public.clientes (nome, cnpj, segmento, status) values
  ('Acme Indústria S.A.',   '11.111.111/0001-11', 'Indústria',  'ATIVO'),
  ('Beta Serviços Ltda.',   '22.222.222/0001-22', 'Serviços',   'PROSPECTO'),
  ('Gama Comércio ME',      null,                  'Varejo',     'INATIVO')
on conflict (cnpj) do nothing;
