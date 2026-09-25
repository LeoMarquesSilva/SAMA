import "server-only";

/** Caso no contrato de POST /casos da app local de agendamento VIOS. */
export type CasoAgendamentoVios = {
  tipo: string;
  tarefa: string;
  observacao: string;
  /** DD/MM/AAAA. */
  data: string;
  pasta: string;
};

export type CasoAgendamentoRecebido = {
  id?: string;
  status?: string;
  motivo?: string;
  ci?: string;
  origem?: string;
  tipoVios?: string;
};

function urlBase(): string {
  return (
    process.env.VIOS_AGENDAMENTO_URL?.trim() || "http://127.0.0.1:3920"
  ).replace(/\/$/, "");
}

export function viosAgendamentoConfigurado(): boolean {
  return Boolean(urlBase());
}

export async function enviarCasosAgendamento(
  casos: CasoAgendamentoVios[]
): Promise<CasoAgendamentoRecebido[]> {
  if (casos.length === 0) {
    throw new Error("Nenhum caso para enviar ao agendamento VIOS.");
  }

  let res: Response;
  try {
    res = await fetch(`${urlBase()}/casos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ casos }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error(
      `App de agendamento VIOS indisponível em ${urlBase()}/casos. Abra a janela da app e tente de novo.`
    );
  }

  const texto = await res.text();
  let corpo: { ok?: boolean; erro?: string; casos?: CasoAgendamentoRecebido[] } =
    {};
  try {
    corpo = texto ? JSON.parse(texto) : {};
  } catch {
    corpo = {};
  }

  if (!res.ok || corpo.ok === false) {
    throw new Error(
      corpo.erro ||
        `Agendamento VIOS recusou o envio (${res.status}).`
    );
  }

  return Array.isArray(corpo.casos) ? corpo.casos : [];
}
