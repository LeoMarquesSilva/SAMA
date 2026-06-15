# SAMA — Sistema de Análise de Metas e Atividades

Sistema web de controle gerencial para acompanhamento de **reuniões externas**
(captação, fidelização, relacionamento) e **atividades internas** (despacho,
revisões, reuniões, timesheet) dos sócios e gerentes. Integração com **Outlook**
(Microsoft Graph) e dashboards analíticos.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 3**
- **Supabase** — PostgreSQL + Auth + Realtime
- Validação com **Zod**, ícones **lucide-react**, gráficos **Recharts**

## Status

Todas as 5 fases estão implementadas:

1. Auth + CRUD usuários (`usuarios`) e clientes VIOS (`pessoas`)
2. Reuniões, atividades internas, timesheet automático (trigger no banco)
3. Outlook via Microsoft Graph (client credentials)
4. Dashboard analítico com filtros por período/pessoa/tipo
5. Exportação CSV/PDF, RLS por papel, PWA instalável

**Extras recentes:** Supabase Realtime (atualização automática das telas), validação
de login (usuário ativo + vínculo em `usuarios`), troca de senha via RPC segura,
`/pessoas` restrito a administradores.

## Papéis e permissões

| Cargo | Acesso |
|-------|--------|
| **Sócio** (`SOCIO`) | Total — vê e gerencia tudo |
| **Sócio de Área** (`SOCIO_AREA`) | Próprios dados (reuniões onde participa, atividades, timesheet, Outlook) |
| **Colaborador** | Idem sócio de área |
| **`is_admin = true`** | Acesso total (ex.: dev/ops), independente do cargo |

Administradores gerenciam usuários em `/pessoas` (ativar login, senha padrão `123456`).

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha no `.env.local`:

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon (client + RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim* | Ativar/desativar logins em `/pessoas` |
| `MICROSOFT_TENANT_ID` | Outlook | Tenant Azure AD |
| `MICROSOFT_CLIENT_ID` | Outlook | App registration |
| `MICROSOFT_CLIENT_SECRET` | Outlook | Secret do app |

\* Sem service role, o CRUD de usuários funciona, mas ativação de login falha.

### 3. Migrations do banco

Aplique **todas** as migrations em ordem via Supabase CLI ou SQL Editor:

```
supabase/migrations/0001_init.sql … 0018_security_realtime.sql
```

Ou, com Supabase CLI local:

```bash
supabase db push
```

Opcional: `supabase/seed.sql` (dados de exemplo).

### 4. Usuários

1. Importe a equipe via migration `0004_import_crm_users.sql` ou cadastre em `/pessoas`.
2. Ative o login pelo botão **Ativar** (cria Auth user + senha `123456`).
3. No primeiro acesso, o usuário **deve trocar a senha**.

### 5. Desenvolvimento

```bash
npm run dev
```

Acesse <http://localhost:3000>. Rotas autenticadas redirecionam para `/login`.

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem TypeScript |

## Sync VIOS (servidor externo)

Scripts em `scripts/` fazem dual-write SIOE + SAMA. Veja `scripts/README.md`.

Variáveis no servidor vios-app:

- `VIOS_USER`, `VIOS_PASS` — credenciais VIOS (**obrigatórias**, sem fallback no código)
- `SAMA_SUPABASE_URL`, `SAMA_SUPABASE_SERVICE_ROLE_KEY` — dual-write SAMA

## Estrutura

```
src/
├── app/
│   ├── (app)/          # rotas autenticadas (sidebar + Realtime)
│   │   ├── dashboard/
│   │   ├── reunioes/
│   │   ├── atividades/
│   │   ├── timesheet/
│   │   ├── pessoas/      # admin only
│   │   ├── clientes/
│   │   ├── outlook/
│   │   └── relatorios/
│   ├── login/
│   ├── trocar-senha/
│   └── api/export/
├── components/
├── hooks/useRealtimeRefresh.ts
└── lib/
    ├── supabase/
    ├── auth.ts           # requireAdmin()
    └── graph.ts          # Microsoft Graph
supabase/migrations/      # 0001–0018
scripts/                  # sync VIOS
```

## Realtime

O layout autenticado assina `postgres_changes` em:

- `outlook_eventos`, `reunioes`, `reuniao_participantes`
- `atividades_internas`, `timesheet_entradas`, `usuarios`

Qualquer alteração dispara `router.refresh()` — badge do Outlook, listas e dashboard
atualizam sem F5. RLS filtra o que cada usuário recebe.

## Outlook (Microsoft Graph)

Integração **app-only** (client credentials). Configure `MICROSOFT_*` no `.env.local`.
Sincronização em `/outlook` importa eventos do calendário para categorização
(reunião / atividade / ignorar).

## Deploy

1. Vercel (ou similar) com variáveis de ambiente
2. `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor (nunca `NEXT_PUBLIC_`)
3. Application Access Policy no Azure se necessário para caixas específicas
