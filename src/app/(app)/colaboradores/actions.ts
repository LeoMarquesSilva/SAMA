"use server";

import { createClient } from "@/lib/supabase/server";
import {
  sincronizarColaboradores,
  type ColaboradorOpt,
} from "@/lib/colaboradores";

export async function listarColaboradores(): Promise<ColaboradorOpt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("colaboradores")
    .select("id, nome, email, departamento, avatar_url, usuario_id")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  return (data as ColaboradorOpt[]) ?? [];
}

export async function syncColaboradoresResponsum() {
  return sincronizarColaboradores();
}
