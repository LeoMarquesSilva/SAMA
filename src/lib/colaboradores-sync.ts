import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { createResponsumClient, type ResponsumUser } from "@/lib/responsum";
import {
  isEmailEscritorio,
  normalizeEscritorioEmail,
  variantesEmailEscritorio,
} from "@/lib/email-escritorio";
import { urlDeFotoUtil } from "@/lib/avatar-url";
import { departamentoCanonico, isSocioFundador, type CargoPessoa } from "@/lib/constants";
import {
  listarFuncionariosOrquestrai,
  type FuncionarioOrquestrai,
} from "@/lib/orquestrai-funcionarios";

export type TipoDivergencia =
  | "sem_registro_orqestrai"
  | "sem_conta_responsum"
  | "area_diferente"
  | "status_diferente";

export type ResultadoSyncColaboradores = {
  ok: boolean;
  error?: string;
  fonte?: "orqestrai";
  total?: number;
  criados?: number;
  atualizados?: number;
  desligados?: number;
  /** Usuários cuja área foi alinhada à do ORQESTRAI. */
  areasAtualizadas?: number;
  divergencias?: number;
  falhas?: number;
  responsum?: boolean;
};

type Local = {
  id: string;
  nome: string;
  orqestrai_id: string | null;
  responsum_id: string | null;
  email: string;
  avatar_url: string | null;
  ativo: boolean;
  usuario_id: string | null;
};

type Divergencia = { tipo: TipoDivergencia; nome: string; email: string | null; detalhe: string };

function chave(email: string | null | undefined): string | null {
  return email?.trim() ? normalizeEscritorioEmail(email) : null;
}

function porEmail<T>(itens: T[], email: (i: T) => string | null | undefined): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const item of itens) {
    const e = email(item);
    if (!e?.trim()) continue;
    for (const v of variantesEmailEscritorio(e)) mapa.set(v.toLowerCase(), item);
  }
  return mapa;
}

function buscar<T>(mapa: Map<string, T>, email: string | null | undefined): T | undefined {
  if (!email?.trim()) return undefined;
  for (const v of variantesEmailEscritorio(email)) {
    const hit = mapa.get(v.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

function mesmaArea(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) =>
    (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return !n(a) || !n(b) || n(a) === n(b);
}

/** Um registro por e-mail; se houver repetido, fica o ativo. */
function deduplicar(funcionarios: FuncionarioOrquestrai[]): FuncionarioOrquestrai[] {
  const mapa = new Map<string, FuncionarioOrquestrai>();
  for (const f of funcionarios) {
    const k = chave(f.email);
    if (!k) continue;
    const atual = mapa.get(k);
    if (!atual || (!atual.ativo && f.ativo)) mapa.set(k, f);
  }
  return [...mapa.values()];
}

async function lerResponsum(): Promise<ResponsumUser[] | null> {
  const client = createResponsumClient();
  if (!client) return null;
  const { data, error } = await client
    .from("app_c009c0e4f1_users")
    .select("id, name, email, department, avatar_url, is_active");
  if (error || !data) return null;
  return data as ResponsumUser[];
}

/**
 * Atualiza o espelho de colaboradores a partir do ORQESTRAI (fonte oficial),
 * cruza com o Responsum quando configurado e registra as divergências.
 * Retorna null quando o ORQESTRAI não está configurado.
 */
export async function sincronizarColaboradoresOrquestrai(): Promise<ResultadoSyncColaboradores | null> {
  const brutos = await listarFuncionariosOrquestrai();
  if (!brutos) return null;
  // Terceirizados, contas de teste e excluídas ficam fora do sync.
  const funcionarios = deduplicar(brutos.filter((f) => f.email && isEmailEscritorio(f.email)));

  const admin = createAdminClient();
  const [responsumRaw, { data: locaisRaw, error: locaisErr }, { data: usuarios }] = await Promise.all([
    lerResponsum(),
    admin.from("colaboradores").select("id, nome, orqestrai_id, responsum_id, email, avatar_url, ativo, usuario_id"),
    admin.from("usuarios").select("id, email, cargo, departamento"),
  ]);
  if (locaisErr) return { ok: false, error: "Falha ao ler colaboradores do SAMA." };

  const responsum = responsumRaw?.filter((r) => r.email && isEmailEscritorio(r.email)) ?? null;
  const locais = (locaisRaw ?? []) as Local[];
  const localPorOrq = new Map(locais.filter((l) => l.orqestrai_id).map((l) => [l.orqestrai_id!, l]));
  const localPorEmail = porEmail(locais, (l) => l.email);
  const localPorEmailExato = new Map(locais.map((l) => [l.email.trim().toLowerCase(), l]));
  const usuarioPorEmail = porEmail(usuarios ?? [], (u) => u.email);
  const responsumPorEmail = porEmail(responsum ?? [], (r) => r.email);

  const agora = new Date().toISOString();
  const divergencias: Divergencia[] = [];
  const inserir: Record<string, unknown>[] = [];
  const atualizar: { id: string; dados: Record<string, unknown> }[] = [];
  const usados = new Set<string>();
  let desligados = 0;

  for (const f of funcionarios) {
    const email = f.email!.trim();
    const local =
      localPorOrq.get(f.funcionario_id) ??
      localPorEmailExato.get(email.toLowerCase()) ??
      buscar(localPorEmail, email);
    const resp = buscar(responsumPorEmail, email);
    if (local) usados.add(local.id);

    const donoDoEmail = localPorEmailExato.get(email.toLowerCase());
    const emailLivre = !donoDoEmail || donoDoEmail.id === local?.id;

    const dados = {
      orqestrai_id: f.funcionario_id,
      nome: f.nome,
      email: emailLivre ? email : local!.email,
      departamento: f.departamento,
      cargo: f.cargo,
      admissao: f.admissao,
      desligamento: f.desligamento,
      vios_ci: f.vios_ci,
      ativo: f.ativo,
      responsum_id: resp?.id ?? local?.responsum_id ?? null,
      avatar_url:
        urlDeFotoUtil(f.foto_url) ??
        urlDeFotoUtil(resp?.avatar_url) ??
        urlDeFotoUtil(local?.avatar_url) ??
        null,
      usuario_id: buscar(usuarioPorEmail, email)?.id ?? local?.usuario_id ?? null,
      sincronizado_em: agora,
    };

    if (local) {
      if (local.ativo && !f.ativo) desligados += 1;
      atualizar.push({ id: local.id, dados });
    } else {
      inserir.push(dados);
    }

    if (responsum) {
      if (!resp && f.ativo) {
        divergencias.push({
          tipo: "sem_conta_responsum",
          nome: f.nome,
          email,
          detalhe: "Ativo no ORQESTRAI, sem conta no Responsum.",
        });
      } else if (resp && resp.is_active !== f.ativo) {
        divergencias.push({
          tipo: "status_diferente",
          nome: f.nome,
          email,
          detalhe: `ORQESTRAI: ${f.ativo ? "ativo" : "inativo"} · Responsum: ${resp.is_active ? "ativo" : "inativo"}.`,
        });
      } else if (resp && f.ativo && !mesmaArea(resp.department, f.departamento)) {
        divergencias.push({
          tipo: "area_diferente",
          nome: f.nome,
          email,
          detalhe: `ORQESTRAI: ${f.departamento ?? "—"} · Responsum: ${resp.department ?? "—"}.`,
        });
      }
    }
  }

  const orqPorEmail = porEmail(funcionarios, (f) => f.email);
  for (const r of responsum ?? []) {
    if (r.is_active && !buscar(orqPorEmail, r.email)) {
      divergencias.push({
        tipo: "sem_registro_orqestrai",
        nome: r.name,
        email: r.email,
        detalhe: "Ativo no Responsum, sem cadastro no ORQESTRAI.",
      });
    }
  }
  const externosAtivos = locais.filter((l) => l.ativo && !isEmailEscritorio(l.email)).map((l) => l.id);
  for (const l of locais) {
    if (!isEmailEscritorio(l.email)) continue;
    if (l.ativo && !usados.has(l.id) && !buscar(responsumPorEmail, l.email)) {
      const duplicado = buscar(orqPorEmail, l.email);
      divergencias.push({
        tipo: "sem_registro_orqestrai",
        nome: l.nome,
        email: l.email,
        detalhe: duplicado
          ? `Registro duplicado de ${duplicado.nome} (${duplicado.email}) — pode ser desativado.`
          : "Colaborador ativo no SAMA sem cadastro no ORQESTRAI (mantido como está).",
      });
    }
  }

  const falhas: string[] = [];
  let criados = 0;
  let atualizados = 0;

  if (inserir.length > 0) {
    const { error } = await admin.from("colaboradores").insert(inserir);
    if (!error) {
      criados = inserir.length;
    } else {
      for (const dados of inserir) {
        const r = await admin.from("colaboradores").insert(dados);
        if (r.error) falhas.push(`${dados.nome}: ${r.error.message}`);
        else criados += 1;
      }
    }
  }
  for (let i = 0; i < atualizar.length; i += 10) {
    const lote = atualizar.slice(i, i + 10);
    const resultados = await Promise.all(
      lote.map(({ id, dados }) => admin.from("colaboradores").update(dados).eq("id", id))
    );
    resultados.forEach((r, j) => {
      if (r.error) falhas.push(`${lote[j].dados.nome}: ${r.error.message}`);
      else atualizados += 1;
    });
  }
  if (externosAtivos.length > 0) {
    await admin.from("colaboradores").update({ ativo: false }).in("id", externosAtivos);
  }

  // A área do usuário segue a do ORQESTRAI — é por ela que o agendamento acha a
  // pasta da área e que a agenda dos colegas da mesma área fica visível.
  // Sócio fundador fica com "Sócio": é o departamento que o identifica.
  const areasUsuario = new Map<string, string>();
  for (const f of funcionarios) {
    if (!f.ativo) continue;
    const area = departamentoCanonico(f.departamento);
    const u = buscar(usuarioPorEmail, f.email);
    if (!area || !u || isSocioFundador(u.cargo as CargoPessoa, u.departamento)) continue;
    if (u.departamento !== area) areasUsuario.set(u.id, area);
  }
  let areasAtualizadas = 0;
  for (const [id, departamento] of areasUsuario) {
    const { error } = await admin.from("usuarios").update({ departamento }).eq("id", id);
    if (error) falhas.push(`área do usuário ${id}: ${error.message}`);
    else areasAtualizadas += 1;
  }
  if (falhas.length > 0) console.error("[sync colaboradores] falhas:", falhas);

  await admin.from("colaboradores_divergencias").delete().not("id", "is", null);
  if (divergencias.length > 0) {
    await admin.from("colaboradores_divergencias").insert(
      divergencias.map((d) => ({ ...d, detectado_em: agora }))
    );
  }

  return {
    ok: true,
    fonte: "orqestrai",
    total: funcionarios.length,
    criados,
    atualizados,
    desligados,
    areasAtualizadas,
    divergencias: divergencias.length,
    falhas: falhas.length,
    responsum: Boolean(responsum),
  };
}
