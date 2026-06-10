"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  tipo: "reuniao" | "cliente" | "pessoa" | "atividade";
  id: string;
  titulo: string;
  subtitulo: string | null;
  href: string;
  avatar_url: string | null;
};

/** Busca global em reuniões, clientes, pessoas e atividades (RLS aplica o escopo). */
export async function globalSearch(q: string): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // PostgREST usa vírgula/parênteses como separadores no .or() — sanitiza.
  const safe = query.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;

  const [reunioes, clientes, pessoas, atividades] = await Promise.all([
    supabase
      .from("reunioes")
      .select("id, titulo, data_hora_inicio")
      .ilike("titulo", like)
      .order("data_hora_inicio", { ascending: false })
      .limit(5),
    supabase
      .from("pessoas")
      .select("ci, nome, cpf_cnpj, grupo_cliente")
      .or(`nome.ilike.${like},cpf_cnpj.ilike.${like}`)
      .order("nome")
      .limit(5),
    supabase
      .from("usuarios")
      .select("id, nome, email, avatar_url")
      .or(`nome.ilike.${like},email.ilike.${like}`)
      .limit(5),
    supabase
      .from("atividades_internas")
      .select("id, titulo, data_hora_inicio")
      .ilike("titulo", like)
      .order("data_hora_inicio", { ascending: false })
      .limit(5),
  ]);

  const fmtData = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

  const results: SearchResult[] = [
    ...(clientes.data ?? [])
      .filter((c): c is typeof c & { ci: string } => Boolean(c.ci))
      .map((c) => ({
      tipo: "cliente" as const,
      id: c.ci,
      titulo: c.nome,
      subtitulo: c.cpf_cnpj ?? c.grupo_cliente ?? null,
      href: `/clientes/${encodeURIComponent(c.ci)}`,
      avatar_url: null,
    })),
    ...(pessoas.data ?? []).map((p) => ({
      tipo: "pessoa" as const,
      id: p.id,
      titulo: p.nome,
      subtitulo: p.email,
      href: "/pessoas",
      avatar_url: p.avatar_url,
    })),
    ...(reunioes.data ?? []).map((r) => ({
      tipo: "reuniao" as const,
      id: r.id,
      titulo: r.titulo,
      subtitulo: fmtData(r.data_hora_inicio),
      href: "/reunioes",
      avatar_url: null,
    })),
    ...(atividades.data ?? []).map((a) => ({
      tipo: "atividade" as const,
      id: a.id,
      titulo: a.titulo,
      subtitulo: fmtData(a.data_hora_inicio),
      href: "/atividades",
      avatar_url: null,
    })),
  ];

  return results.slice(0, 16);
}
