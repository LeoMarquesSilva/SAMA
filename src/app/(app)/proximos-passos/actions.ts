"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CALENDARIO_PATH } from "@/lib/calendario";
import { PROXIMOS_PASSOS_PATH, toggleItemChecklist } from "@/lib/proximos-passos";

export type ActionResult = { ok: boolean; error?: string };

function revalidatePassos() {
  revalidatePath(PROXIMOS_PASSOS_PATH);
  revalidatePath(CALENDARIO_PATH);
  revalidatePath("/dashboard");
}

export async function togglePassoReuniao(
  reuniaoId: string,
  itemIndex: number,
  done: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: reuniao, error: fetchError } = await supabase
    .from("reunioes")
    .select("proximos_passos")
    .eq("id", reuniaoId)
    .maybeSingle();

  if (fetchError || !reuniao) {
    return { ok: false, error: "Reunião não encontrada." };
  }

  let passos: string;
  try {
    passos = toggleItemChecklist(reuniao.proximos_passos, itemIndex, done);
  } catch {
    return { ok: false, error: "Item não encontrado." };
  }

  const { error } = await supabase.rpc("update_reuniao_proximos_passos", {
    rid: reuniaoId,
    passos,
  });

  if (error) {
    return { ok: false, error: "Erro ao atualizar o passo." };
  }

  revalidatePassos();
  return { ok: true };
}

export async function atualizarPassosReuniao(
  reuniaoId: string,
  passos: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_reuniao_proximos_passos", {
    rid: reuniaoId,
    passos,
  });

  if (error) {
    return { ok: false, error: "Erro ao salvar os passos." };
  }

  revalidatePassos();
  return { ok: true };
}
