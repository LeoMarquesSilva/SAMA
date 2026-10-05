"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import type { PastaProcessoOpcao } from "@/lib/vios-agendamento";

export async function listarPastasDoProcesso(
  cnj: string
): Promise<{ ok: true; pastas: PastaProcessoOpcao[] } | { ok: false; erro: string }> {
  const pessoa = await getPessoaAtual();
  if (!pessoa) return { ok: false, erro: "Não autenticado." };

  const digitos = String(cnj ?? "").replace(/\D/g, "");
  if (digitos.length !== 20) return { ok: true, pastas: [] };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("processos_por_cnj", { p_digitos: digitos });
  if (error) return { ok: false, erro: error.message };

  const pastas = ((data ?? []) as PastaProcessoOpcao[])
    .filter((p) => p?.ci && /^ativo$/i.test(String(p.situacao_processo ?? "").trim()))
    .map((p) => ({
      ci: String(p.ci).trim(),
      situacao_processo: p.situacao_processo?.trim() || null,
      acao: p.acao?.trim() || null,
      nro_cnj: p.nro_cnj?.trim() || null,
    }));
  return { ok: true, pastas };
}
