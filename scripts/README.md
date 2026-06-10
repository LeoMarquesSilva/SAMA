# Sync VIOS → Supabase (SIOE + SAMA)

Scripts para rodar no **vios-app** (servidor). Copie `sync-vios-to-supabase.js` e os runners (`RelatorioPessoas.js`, etc.) para a pasta do vios-app.

## Variáveis de ambiente (`.env` do vios-app)

```env
# SIOE (projeto principal — já existente)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# SAMA (dual-write — novo)
SAMA_SUPABASE_URL=https://yyyy.supabase.co
SAMA_SUPABASE_SERVICE_ROLE_KEY=eyJ...   # obrigatório para escrita (RLS só permite leitura anon)

VIOS_USER=...
VIOS_PASS=...
```

Obtenha URL e **service role** do SAMA em: Supabase → Project Settings → API.

## Ordem recomendada (importante para `pessoa_id`)

1. **RelatorioPessoas.js** → `pessoas` (SIOE + SAMA)
2. **Processo Completo** (`runSync`) → `processos_completo` + RPC `processos_completo_vinculacao_pessoa`
3. **TimeSheets** (`runSyncTimeSheets`) → `timesheets` + RPC `timesheets_vinculacao_pessoa`

Sem pessoas antes, processos/timesheets sobem mas ficam sem vínculo até rodar pessoas e a RPC de vinculação de novo.

## Tabelas no SAMA (schema igual SIOE)

| Relatório VIOS | Tabela SAMA | Upsert key |
|----------------|-------------|------------|
| Clientes/Pessoas CSV | `pessoas` | `ci` |
| Processo Completo | `processos_completo` | `ci` |
| TimeSheets | `timesheets` | `ci` |

Views de grupos (automáticas após sync): `escritorio_empresas_por_grupo`, `escritorio_grupos_resumo`, `pessoas_escritorio`.

Financeiro (`financeiro_parcelas`, etc.) **não** está no SAMA — dual-write não incluído.

## O que mudou em relação à versão anterior

- SAMA deixou de usar `vios_pessoas` / `clientes` → agora **`pessoas`** com `id` uuid + `ci` unique
- Dual-write também em **processos** e **timesheets**
- RPCs de vinculação criadas no SAMA (`0014_vinculacao_pessoa.sql`)
