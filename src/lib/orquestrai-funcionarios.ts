import "server-only";

const URL_PADRAO = "https://qwihfvagemzlyypeohpc.supabase.co";
const PUBLISHABLE_PADRAO = "sb_publishable_8wnMMih1ehocntHTvRJ3_A_YSt4qQIy";

export type FuncionarioOrquestrai = {
  funcionario_id: string;
  nome: string;
  email: string | null;
  departamento: string | null;
  cargo: string | null;
  admissao: string | null;
  desligamento: string | null;
  ativo: boolean;
  vios_ci: string | null;
};

/**
 * Cadastro de funcionários do ORQESTRAI (RPC só-leitura `sama_listar_funcionarios`,
 * autorizada pela chave do consumidor "sama"). Retorna null se a chave não estiver configurada.
 */
export async function listarFuncionariosOrquestrai(): Promise<FuncionarioOrquestrai[] | null> {
  const chave = process.env.ORQUESTRAI_PHOTOS_API_KEY?.trim();
  if (!chave) return null;

  const base = (process.env.ORQUESTRAI_SUPABASE_URL?.trim() || URL_PADRAO).replace(/\/+$/, "");
  const publishable = process.env.ORQUESTRAI_PUBLISHABLE_KEY?.trim() || PUBLISHABLE_PADRAO;

  const res = await fetch(`${base}/rest/v1/rpc/sama_listar_funcionarios`, {
    method: "POST",
    headers: { apikey: publishable, "Content-Type": "application/json" },
    body: JSON.stringify({ p_api_key: chave }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? "O ORQESTRAI recusou a chave do SAMA (permissão employees:read)."
        : `Falha ao ler funcionários do ORQESTRAI (${res.status}).`
    );
  }
  return (await res.json()) as FuncionarioOrquestrai[];
}
