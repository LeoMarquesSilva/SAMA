import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { startOfDayInstantInTz } from "@/lib/timezone";
import {
  isClusterAgenda,
  isGrupoInternoAgenda,
  mesKeyInTz,
  separarAreas,
  somarMeses,
  type AgendaPositivaCliente,
} from "@/lib/agenda-positiva";
import { criarCasadorDeGrupo, tituloTemPalavraDeReuniao } from "@/lib/agenda-positiva-titulo";

const PAGINA = 1000;

/** Clientes com cluster e meta. semTabela: a migration 0057 ainda não foi aplicada. */
export async function listarAgendaPositiva(): Promise<{
  clientes: AgendaPositivaCliente[];
  semTabela: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_positiva_clientes")
    .select("grupo_cliente, cluster, meta_mensal")
    .order("cluster")
    .order("grupo_cliente");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { clientes: [], semTabela: true };
    }
    throw new Error(error.message);
  }
  const clientes = (data ?? []).flatMap((r) =>
    isClusterAgenda(r.cluster)
      ? [{ grupo_cliente: r.grupo_cliente, cluster: r.cluster, meta_mensal: r.meta_mensal }]
      : []
  );
  return { clientes, semTabela: false };
}

/**
 * Todos os grupos cliente do escritório (os mesmos da tela Clientes), com ou sem
 * cluster na agenda. Fora: cadastros sem grupo e os grupos internos do escritório.
 * Service role pelo mesmo motivo de reunioesPorCliente: a lista é do escritório.
 */
export async function listarGruposCliente(): Promise<string[]> {
  const admin = createAdminClient();
  const grupos: string[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await admin
      .from("escritorio_grupos_resumo")
      .select("grupo_cliente")
      .order("grupo_cliente")
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const g = (r.grupo_cliente ?? "").trim();
      if (g && !isGrupoInternoAgenda(g)) grupos.push(g);
    }
    if ((data?.length ?? 0) < PAGINA) break;
  }
  return [...new Set(grupos)];
}

export type ReuniaoDoCliente = {
  /**
   * Grupo do cliente na tabela de clientes (o mesmo do campo Cliente da reunião):
   * o do cadastro ou, sem ele, o herdado dos processos. Sem grupo, o nome.
   */
  cliente: string;
  semGrupo: boolean;
  mes: string;
  inicio: string;
  status: string;
  tipo: string;
  titulo: string;
  /** Departamentos de quem lançou, dos participantes do escritório e dos calendários. */
  areas: string[];
};

function departamentos(...listas: (string | null | undefined)[][]): string[] {
  return [...new Set(listas.flat().map((d) => (d ?? "").trim()).filter(Boolean))];
}

/** Grupo da tabela de clientes para cadastros sem grupo próprio (herdado dos processos). */
async function grupoHerdadoPorCi(
  admin: ReturnType<typeof createAdminClient>,
  cis: string[]
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(cis)];
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await admin
      .from("escritorio_empresas_por_grupo")
      .select("ci, grupo_cliente")
      .in("ci", unicos.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const g = (r.grupo_cliente ?? "").trim();
      if (r.ci && g) mapa.set(r.ci, g);
    }
  }
  return mapa;
}

/**
 * Reuniões não canceladas entre o 1º dia de `mesDe` e o último de `mesAte`, de
 * todo o escritório. Usa a service role porque a Agenda Positiva mede a cobertura
 * do cliente, não a agenda de quem está olhando — o acesso é o módulo
 * agenda-positiva, e a tela só mostra contagens e datas.
 */
export async function reunioesPorCliente(
  mesDe: string,
  mesAte: string,
  opts: { tipo?: string } = {}
): Promise<ReuniaoDoCliente[]> {
  const de = new Date(startOfDayInstantInTz(`${mesDe}-01`)).toISOString();
  const ate = new Date(startOfDayInstantInTz(`${somarMeses(mesAte, 1)}-01`)).toISOString();
  const admin = createAdminClient();

  type Linha = {
    tipo: string;
    status: string;
    titulo: string | null;
    data_hora_inicio: string;
    cliente: { ci: string; nome: string | null; grupo_cliente: string | null } | null;
    criador: { departamento: string | null } | null;
    participantes: { colaborador: { departamento: string | null } | null }[] | null;
    copias: { pessoa: { departamento: string | null } | null }[] | null;
  };
  const brutas: Linha[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    let q = admin
      .from("reunioes")
      .select(
        "id, tipo, status, titulo, data_hora_inicio, cliente:pessoas(ci, nome, grupo_cliente), criador:usuarios(departamento), participantes:reuniao_participantes(colaborador:colaboradores(departamento)), copias:outlook_eventos(pessoa:usuarios(departamento))"
      )
      .neq("status", "CANCELADA")
      .not("cliente_id", "is", null)
      .gte("data_hora_inicio", de)
      .lt("data_hora_inicio", ate)
      .order("id")
      .range(desde, desde + PAGINA - 1);
    if (opts.tipo) q = q.eq("tipo", opts.tipo);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    brutas.push(...((data ?? []) as unknown as Linha[]));
    if ((data?.length ?? 0) < PAGINA) break;
  }

  const semGrupoProprio = brutas
    .filter((r) => r.cliente && !(r.cliente.grupo_cliente ?? "").trim())
    .map((r) => r.cliente!.ci);
  const herdado = semGrupoProprio.length
    ? await grupoHerdadoPorCi(admin, semGrupoProprio)
    : new Map<string, string>();

  return brutas.flatMap((r) => {
    const grupo =
      (r.cliente?.grupo_cliente ?? "").trim() || (r.cliente ? herdado.get(r.cliente.ci) : "") || "";
    const cliente = grupo || (r.cliente?.nome ?? "").trim();
    if (!cliente) return [];
    return [
      {
        cliente,
        semGrupo: !grupo,
        mes: mesKeyInTz(r.data_hora_inicio),
        inicio: r.data_hora_inicio,
        status: r.status,
        tipo: r.tipo,
        titulo: r.titulo ?? "",
        areas: departamentos(
          [r.criador?.departamento],
          (r.participantes ?? []).map((p) => p.colaborador?.departamento),
          (r.copias ?? []).map((c) => c.pessoa?.departamento)
        ),
      },
    ];
  });
}

export type EventoOutlookDoGrupo = {
  grupo: string;
  mes: string;
  inicio: string;
  titulo: string;
  /** Departamento de quem tem o evento no calendário. */
  areas: string[];
};

/**
 * Áreas dos processos de cada grupo cliente ("Cível | Insolvência" conta nas
 * duas). São ~34 mil processos lidos em páginas; fica 1 hora em cache.
 */
export const listarAreasDosGrupos = unstable_cache(
  async (): Promise<Record<string, string[]>> => {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("processos_completo")
      .select("id", { count: "exact", head: true })
      .not("grupo_cliente", "is", null);
    if (error) throw new Error(error.message);

    const paginas = Math.ceil((count ?? 0) / PAGINA);
    const areas = new Map<string, Set<string>>();
    for (let lote = 0; lote < paginas; lote += 10) {
      const resultados = await Promise.all(
        Array.from({ length: Math.min(10, paginas - lote) }, (_, i) => {
          const desde = (lote + i) * PAGINA;
          return admin
            .from("processos_completo")
            .select("grupo_cliente, area")
            .not("grupo_cliente", "is", null)
            .order("id")
            .range(desde, desde + PAGINA - 1);
        })
      );
      for (const { data, error: e } of resultados) {
        if (e) throw new Error(e.message);
        for (const p of data ?? []) {
          const g = (p.grupo_cliente ?? "").trim();
          if (!g) continue;
          const conjunto = areas.get(g) ?? new Set<string>();
          for (const a of separarAreas(p.area)) conjunto.add(a);
          areas.set(g, conjunto);
        }
      }
    }
    return Object.fromEntries([...areas].map(([g, s]) => [g, [...s].sort()]));
  },
  ["agenda-positiva-areas-grupos-v1"],
  { revalidate: 3600 }
);

/** Departamentos de quem usa o SAMA (usuários e colaboradores ativos). */
export async function listarAreasResponsaveis(): Promise<string[]> {
  const admin = createAdminClient();
  const [{ data: usuarios }, { data: colaboradores }] = await Promise.all([
    admin.from("usuarios").select("departamento").is("desativado_em", null),
    admin.from("colaboradores").select("departamento").eq("ativo", true),
  ]);
  return departamentos(
    (usuarios ?? []).map((u) => u.departamento),
    (colaboradores ?? []).map((c) => c.departamento)
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function emailDoEscritorio(email: string): boolean {
  return /@(bpplaw|bismarchipires)\.com\.br$/i.test(email.trim());
}

/**
 * Eventos do Outlook (calendário de todos que sincronizam) que ninguém classificou
 * no SAMA e cujo título cita um grupo cliente. Só entra o que parece reunião: tem
 * convidado de fora do escritório ou o título diz reunião/call/presencial etc. —
 * assim "Ligar fulano" ou "Análise planilha X" não contam. Ignorados ficam fora.
 *
 * Fica 5 minutos em cache: são milhares de eventos por semestre. Quem classifica
 * um evento no calendário vê na hora — vira reunião do SAMA, e a cópia antiga do
 * Outlook cai na regra de "mesmo título e horário" de juntarEncontros.
 */
export const eventosOutlookDaAgenda = unstable_cache(
  (mesDe: string, mesAte: string) => eventosOutlookDosGrupos(mesDe, mesAte),
  ["agenda-positiva-outlook-v2"],
  { revalidate: 300 }
);

type EventoBruto = { id: string; titulo: string; inicio: string; pessoa_id: string };

async function eventosOutlookDosGrupos(
  mesDe: string,
  mesAte: string
): Promise<EventoOutlookDoGrupo[]> {
  const admin = createAdminClient();

  // Um mês por consulta, todas ao mesmo tempo (são ~1.000 eventos por mês).
  async function doMes(mes: string): Promise<EventoBruto[]> {
    const de = new Date(startOfDayInstantInTz(`${mes}-01`)).toISOString();
    const ate = new Date(startOfDayInstantInTz(`${somarMeses(mes, 1)}-01`)).toISOString();
    const linhas: EventoBruto[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await admin
        .from("outlook_eventos")
        .select("id, titulo, inicio, pessoa_id")
        .eq("status", "PENDENTE")
        .gte("inicio", de)
        .lt("inicio", ate)
        .order("id")
        .range(desde, desde + PAGINA - 1);
      if (error) throw new Error(error.message);
      for (const e of data ?? []) {
        if (e.inicio && e.titulo) {
          linhas.push({ id: e.id, titulo: e.titulo, inicio: e.inicio, pessoa_id: e.pessoa_id });
        }
      }
      if ((data?.length ?? 0) < PAGINA) break;
    }
    return linhas;
  }

  const meses: string[] = [];
  for (let m = mesDe; m <= mesAte; m = somarMeses(m, 1)) meses.push(m);
  const [grupos, porMes, { data: usuarios }] = await Promise.all([
    listarGruposCliente(),
    Promise.all(meses.map(doMes)),
    admin.from("usuarios").select("id, departamento"),
  ]);
  const casar = criarCasadorDeGrupo(grupos);
  const departamentoDe = new Map(
    (usuarios ?? []).map((u) => [u.id as string, (u.departamento ?? "").trim()])
  );
  const brutos = porMes.flat();

  const achados = brutos.flatMap((e) => {
    const grupo = casar(e.titulo);
    if (!grupo) return [];
    const dep = departamentoDe.get(e.pessoa_id);
    return [
      {
        id: e.id,
        grupo,
        mes: mesKeyInTz(e.inicio),
        inicio: e.inicio,
        titulo: e.titulo,
        areas: dep ? [dep] : [],
        confirmado: tituloTemPalavraDeReuniao(e.titulo),
      },
    ];
  });

  // Sem palavra de reunião no título, vale só com convidado de fora do escritório.
  const aConferir = achados.filter((a) => !a.confirmado).map((a) => a.id);
  const lotes: string[][] = [];
  for (let i = 0; i < aConferir.length; i += 150) lotes.push(aConferir.slice(i, i + 150));
  const comExterno = new Set<string>();
  await Promise.all(
    lotes.map(async (ids) => {
      const { data, error } = await admin
        .from("outlook_eventos")
        .select("id, participantes")
        .in("id", ids);
      if (error) throw new Error(error.message);
      for (const e of data ?? []) {
        const lista = Array.isArray(e.participantes) ? (e.participantes as { email?: string }[]) : [];
        if (lista.some((p) => p?.email && !emailDoEscritorio(p.email))) comExterno.add(e.id);
      }
    })
  );

  return achados
    .filter((a) => a.confirmado || comExterno.has(a.id))
    .map(({ grupo, mes, inicio, titulo, areas }) => ({ grupo, mes, inicio, titulo, areas }));
}
