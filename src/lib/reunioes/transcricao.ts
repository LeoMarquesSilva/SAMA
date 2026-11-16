import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { buscarTranscricaoFellow, fellowConfigurado } from "@/lib/fellow";
import type { ReuniaoTranscricao } from "@/types/database";

const COLUNAS =
  "reuniao_id, fellow_recording_id, idioma, gravacao_inicio, gravacao_fim, segmentos, importado_em";

/**
 * Busca no Fellow a transcrição da reunião e guarda em reuniao_transcricoes.
 * Se já estiver guardada, devolve a que está no banco sem chamar o Fellow.
 * Null quando o Fellow não está configurado, a reunião ainda não começou ou não
 * há gravação com falas — nada é gravado nesses casos, e a próxima chamada tenta de novo.
 *
 * Usa a service role: quem chama já conferiu que a pessoa pode ver a reunião.
 */
export async function guardarTranscricaoFellow(
  reuniaoId: string
): Promise<ReuniaoTranscricao | null> {
  if (!fellowConfigurado() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createAdminClient();

  const { data: existente } = await admin
    .from("reuniao_transcricoes")
    .select(COLUNAS)
    .eq("reuniao_id", reuniaoId)
    .maybeSingle();
  if (existente) return existente as ReuniaoTranscricao;

  const { data: reuniao } = await admin
    .from("reunioes")
    .select("titulo, outlook_event_id, data_hora_inicio")
    .eq("id", reuniaoId)
    .maybeSingle();
  if (!reuniao?.data_hora_inicio) return null;
  if (new Date(reuniao.data_hora_inicio).getTime() > Date.now()) return null;

  const t = await buscarTranscricaoFellow({
    outlook_event_id: reuniao.outlook_event_id,
    titulo: reuniao.titulo,
    data_hora_inicio: reuniao.data_hora_inicio,
  });
  if (!t) return null;

  const { data, error } = await admin
    .from("reuniao_transcricoes")
    .upsert(
      {
        reuniao_id: reuniaoId,
        fellow_recording_id: t.recordingId,
        idioma: t.idioma,
        gravacao_inicio: t.inicio,
        gravacao_fim: t.fim,
        segmentos: t.segmentos,
      },
      { onConflict: "reuniao_id" }
    )
    .select(COLUNAS)
    .single();
  if (error) {
    console.error("[guardarTranscricaoFellow]", reuniaoId, error.message);
    return null;
  }
  return data as ReuniaoTranscricao;
}
