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
      admin.from("colaboradores").select("departamento"),
      admin.from("reuniao_pastas_area").select("area, pasta"),
    ]);
  if (pessoasErr) throw new Error(pessoasErr.message);
  if (pastasErr && pastasErr.code !== "42P01") throw new Error(pastasErr.message);

  const contagem = new Map<string, { area: string; pessoas: number }>();
  for (const row of pessoas ?? []) {
    const area = row.departamento?.trim();
    if (!area) continue;
    const atual = contagem.get(chaveArea(area));
    if (atual) atual.pessoas += 1;
    else contagem.set(chaveArea(area), { area, pessoas: 1 });
  }

  const pastaPorChave = new Map<string, string>();
  for (const row of pastas ?? []) {
    const area = row.area?.trim();
    const pasta = row.pasta?.replace(/\D/g, "") ?? "";
    if (!area || !pasta) continue;
    pastaPorChave.set(chaveArea(area), pasta);
    if (!contagem.has(chaveArea(area))) {
      contagem.set(chaveArea(area), { area, pessoas: 0 });
    }
  }

  return [...contagem.values()]
    .map((item) => ({
      ...item,
      pasta: pastaPorChave.get(chaveArea(item.area)) ?? "",
    }))
    .sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
}
