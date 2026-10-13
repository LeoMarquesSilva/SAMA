"use server";

import { LIMITE_PRINT_CHARS } from "@/lib/capturar-tela";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { variantesEmailEscritorio } from "@/lib/email-escritorio";
import { createResponsumClient } from "@/lib/responsum";

/** Manutenção em Sistemas → SAMA, o mesmo caminho do reporte do SIOE. */
const CATEGORY_KEY = "manutencao_em_sistemas";
/** Id da categoria Manutenção em Sistemas (o mesmo que o SIOE usa). A chave da
 * subcategoria pode se repetir em outra categoria. */
const CATEGORY_ID = "49d8f44b-8f11-4bdd-9d13-7418c522884e";
const SUBCATEGORY_KEY = "sama";
/** Bucket da Responsum onde a própria UI guarda os anexos dos chamados. */
const ATTACHMENTS_BUCKET = "attachments";
const PRINT_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

export type ReportarErroResult = {
  ok: boolean;
  error?: string;
  ticketId?: string;
  responsavel?: string | null;
  /** Chamado criado, mas o print não foi anexado. */
  semPrint?: boolean;
};

/** Abre um chamado na Responsum, na subcategoria SAMA, com o print da tela. */
export async function reportarErroSama(input: {
  titulo: string;
  descricao: string;
  rota?: string | null;
  print?: string | null;
}): Promise<ReportarErroResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.email) return { ok: false, error: "Não autenticado." };

  const responsum = createResponsumClient();
  if (!responsum) {
    return { ok: false, error: "Responsum não configurado no servidor." };
  }

  const titulo = input.titulo?.trim() ?? "";
  const descricao = input.descricao?.trim() ?? "";
  if (!titulo) return { ok: false, error: "Informe o título." };
  if (!descricao) return { ok: false, error: "Informe a descrição." };

  // A conta na Responsum pode estar no outro domínio do escritório (bpplaw ↔ bismarchipires).
  const { data: usuario, error: userErr } = await responsum
    .from("app_c009c0e4f1_users")
    .select("id, name, department")
    .or(variantesEmailEscritorio(pessoa.email).map((e) => `email.ilike.${e}`).join(","))
    .limit(1)
    .maybeSingle();
  if (userErr) {
    return { ok: false, error: "Falha ao consultar a Responsum." };
  }
  if (!usuario?.id) {
    return {
      ok: false,
      error: "Seu e-mail não tem conta na Responsum.",
    };
  }

  const { data: subcategoria } = await responsum
    .from("app_c009c0e4f1_subcategories")
    .select("default_assigned_to, default_assigned_to_name")
    .eq("category_id", CATEGORY_ID)
    .eq("key", SUBCATEGORY_KEY)
    .maybeSingle();

  const rota = input.rota?.trim();
  const texto = rota ? `${descricao}\n\nRota no SAMA: ${rota}` : descricao;

  const { data: criado, error: insertError } = await responsum
    .from("app_c009c0e4f1_tickets")
    .insert({
      title: titulo.slice(0, 240),
      description: texto,
      category: CATEGORY_KEY,
      subcategory: SUBCATEGORY_KEY,
      priority: "high",
      created_by: usuario.id,
      created_by_name: usuario.name,
      created_by_department: usuario.department ?? null,
      assigned_to: subcategoria?.default_assigned_to ?? null,
      assigned_to_name: subcategoria?.default_assigned_to_name ?? null,
    })
    .select("id")
    .single();

  if (insertError || !criado?.id) {
    return { ok: false, error: insertError?.message ?? "Falha ao criar o chamado." };
  }

  const semPrint = input.print
    ? !(await anexarPrint(responsum, criado.id, usuario, input.print))
    : false;

  return {
    ok: true,
    ticketId: criado.id,
    responsavel: subcategoria?.default_assigned_to_name ?? null,
    semPrint,
  };
}

/**
 * Sobe o PNG em attachments/tickets/{id}/ e o anexa numa mensagem da conversa
 * do chamado, como o SIOE faz. Falhar aqui não desfaz o chamado.
 */
async function anexarPrint(
  responsum: NonNullable<ReturnType<typeof createResponsumClient>>,
  ticketId: string,
  usuario: { id: string; name: string },
  print: string
): Promise<boolean> {
  if (print.length > LIMITE_PRINT_CHARS) return false;
  const base64 = PRINT_RE.exec(print)?.[1];
  if (!base64) return false;
  const bytes = Buffer.from(base64, "base64");

  const nome = "sama-print.png";
  const caminho = `tickets/${ticketId}/${Date.now()}-${nome}`;
  const { error: uploadErr } = await responsum.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(caminho, bytes, { contentType: "image/png", upsert: false });
  if (uploadErr) {
    console.error("[reportar-erro] upload do print:", uploadErr.message);
    return false;
  }
  const { data: publico } = responsum.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(caminho);

  const { error: chatErr } = await responsum.from("app_c009c0e4f1_chat_messages").insert({
    ticket_id: ticketId,
    user_id: usuario.id,
    user_name: usuario.name,
    user_role: "user",
    message: "Print da tela do SAMA.",
    attachments: [{ url: publico.publicUrl, name: nome, size: bytes.length, type: "image/png" }],
    read: false,
  });
  if (chatErr) {
    console.error("[reportar-erro] mensagem com o print:", chatErr.message);
    return false;
  }
  return true;
}
