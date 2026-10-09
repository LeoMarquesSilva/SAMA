import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { PastaAtendimentoArea } from "@/lib/reuniao-pastas";

export type { PastaAtendimentoArea };

function chaveArea(valor: string | null | undefined): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Áreas dos colaboradores e a pasta de atendimento configurada para cada uma. */
export async function listarPastasAtendimento(): Promise<PastaAtendimentoArea[]> {
  const admin = createAdminClient();
  const [{ data: pessoas, error: pessoasErr }, { data: pastas, error: pastasErr }] =
    await Promise.all([
      admin.from("colaboradores").select("nome, departamento, ativo"),
      admin.from("reuniao_pastas_area").select("area, pasta"),
    ]);
  if (pessoasErr) throw new Error(pessoasErr.message);
  if (pastasErr && pastasErr.code !== "42P01") throw new Error(pastasErr.message);

  const contagem = new Map<string, { area: string; nomes: string[] }>();
  for (const row of pessoas ?? []) {
    if (row.ativo === false) continue;
    const area = row.departamento?.trim();
    const nome = row.nome?.trim();
    if (!area || !nome) continue;
    const chave = chaveArea(area);
    const atual = contagem.get(chave) ?? { area, nomes: [] };
    atual.nomes.push(nome);
    contagem.set(chave, atual);
  }

  const pastaPorChave = new Map<string, string>();
  for (const row of pastas ?? []) {
    const area = row.area?.trim();
    const pasta = row.pasta?.replace(/\D/g, "") ?? "";
    if (!area || !pasta) continue;
    pastaPorChave.set(chaveArea(area), pasta);
    if (!contagem.has(chaveArea(area))) {
      contagem.set(chaveArea(area), { area, nomes: [] });
    }
  }

  return [...contagem.values()]
    .map((item) => {
      const nomes = [...item.nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
      return {
        area: item.area,
        nomes,
        pessoas: nomes.length,
        pasta: pastaPorChave.get(chaveArea(item.area)) ?? "",
      };
    })
    .sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
}
