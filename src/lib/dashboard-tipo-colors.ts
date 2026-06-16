/** Cores únicas por tipo — compartilhadas entre cards e gráfico do dashboard. */
export const DASHBOARD_TIPO_COLORS: Record<string, string> = {
  "reuniao:CAPTACAO": "#101f2e",
  "reuniao:FIDELIZACAO": "#10b981",
  "reuniao:RELACIONAMENTO_INSTITUCIONAL": "#f59e0b",
  "reuniao:GESTAO_ESTRATEGICA": "#8b5cf6",
  "reuniao:GESTAO_EQUIPE": "#64748b",
  "reuniao:GESTAO_OPERACIONAL": "#ef4444",
  "atividade:PARECER": "#0ea5e9",
  "atividade:DESPACHO": "#6366f1",
  "atividade:REVISAO_PRAZO": "#a16207",
  "atividade:ELABORACAO_PRAZO": "#14b8a6",
  "atividade:AUDIENCIA": "#f97316",
  "atividade:SUSTENTACAO_ORAL": "#ec4899",
  "atividade:PALESTRAS_EVENTOS": "#84cc16",
  "atividade:LEVANTAMENTO_DUE_PROPOSTA_CONTRATO": "#0891b2",
};

const FALLBACK = "#94a3b8";

export function dashboardTipoColor(id: string): string {
  return DASHBOARD_TIPO_COLORS[id] ?? FALLBACK;
}
