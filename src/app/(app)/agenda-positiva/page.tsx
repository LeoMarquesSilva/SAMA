import { Fragment } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Settings,
  XCircle,
} from "lucide-react";
import { requireModulo } from "@/lib/auth";
import { getModulosAtuais } from "@/lib/currentPessoa";
import { temModulo } from "@/lib/modulos";
import { formatDate } from "@/lib/format";
import { listarTiposReuniao } from "@/lib/reuniao-tipos.server";
import {
  listarAgendaPositiva,
  reunioesPorCliente,
} from "@/lib/agenda-positiva.server";
import {
  CLUSTERS_AGENDA,
  CLUSTER_CLASSES,
  isClusterAgenda,
  isGrupoInternoAgenda,
  labelCluster,
  labelMesCurto,
  labelMesLongo,
  mesAtualKey,
  mesesAte,
  parseMesKey,
  situacaoMeta,
  type ClusterAgenda,
} from "@/lib/agenda-positiva";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AgendaPositivaFiltros } from "@/components/agenda-positiva/AgendaPositivaFiltros";

export const dynamic = "force-dynamic";

const MESES_NA_GRADE = 6;
const RANKING_VISIVEL = 15;

/** Situação do cliente no mês escolhido; "agendada" só vale para o mês em curso. */
type Situacao = "cumprida" | "agendada" | "parcial" | "zerada";

const SITUACAO: Record<
  Situacao,
  { label: string; icon: typeof CheckCircle2; classes: string; ordem: number }
> = {
  zerada: { label: "Sem reunião", icon: XCircle, classes: "bg-red-50 text-red-700", ordem: 0 },
  parcial: { label: "Abaixo da meta", icon: AlertTriangle, classes: "bg-amber-50 text-amber-800", ordem: 1 },
  agendada: { label: "Meta agendada", icon: CalendarClock, classes: "bg-brand-50 text-brand-700", ordem: 2 },
  cumprida: { label: "Meta cumprida", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-700", ordem: 3 },
};

/** Fundo de cada mês da grade, pela relação reuniões × meta. */
const CELULA: Record<"cumprida" | "parcial" | "zerada" | "emCurso", string> = {
  cumprida: "bg-emerald-100 text-emerald-800",
  parcial: "bg-amber-100 text-amber-900",
  zerada: "bg-red-50 text-red-600",
  emCurso: "border border-dashed border-slate-300 bg-white text-slate-600",
};

type Contagem = {
  porMes: Record<string, number>;
  /** Agendadas (ainda não realizadas) no mês escolhido. */
  agendadas: number;
  ultima: string | null;
};

export default async function AgendaPositivaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cluster?: string; tipo?: string }>;
}) {
  const eu = await requireModulo("agenda-positiva");
  const sp = await searchParams;
  const mesAtual = mesAtualKey();
  const mesPedido = parseMesKey(sp.mes);
  const mes = mesPedido > mesAtual ? mesAtual : mesPedido;
  const cluster: ClusterAgenda | "" = isClusterAgenda(sp.cluster ?? "")
    ? (sp.cluster as ClusterAgenda)
    : "";
  const tipo = sp.tipo || "";
  const meses = mesesAte(mes, MESES_NA_GRADE);
  const emCurso = mes === mesAtual;

  const [agenda, reunioes, tiposReuniao, modulos] = await Promise.all([
    listarAgendaPositiva(),
    reunioesPorCliente(meses[0], mes, { tipo }),
    listarTiposReuniao(),
    getModulosAtuais(),
  ]);
  const podeConfigurar = temModulo({ isAdmin: eu.is_admin, modulos }, "configuracoes");

  // ─── Contagem por cliente ──────────────────────────────────────────────────
  const contagem = new Map<string, Contagem>();
  for (const r of reunioes) {
    const c = contagem.get(r.cliente) ?? { porMes: {}, agendadas: 0, ultima: null };
    if (r.status === "REALIZADA") {
      c.porMes[r.mes] = (c.porMes[r.mes] ?? 0) + 1;
      if (!c.ultima || r.inicio > c.ultima) c.ultima = r.inicio;
    } else if (r.mes === mes && (r.status === "AGENDADA" || r.status === "REAGENDADA")) {
      c.agendadas += 1;
    }
    contagem.set(r.cliente, c);
  }

  // ─── Clientes da agenda ────────────────────────────────────────────────────
  const clusterDe = new Map(agenda.clientes.map((c) => [c.grupo_cliente, c.cluster]));
  const linhas = agenda.clientes
    .filter((c) => !cluster || c.cluster === cluster)
    .map((c) => {
      const cont = contagem.get(c.grupo_cliente);
      const realizadas = cont?.porMes[mes] ?? 0;
      const agendadas = emCurso ? cont?.agendadas ?? 0 : 0;
      let situacao: Situacao = situacaoMeta(realizadas, c.meta_mensal);
      if (situacao !== "cumprida" && realizadas + agendadas >= c.meta_mensal) {
        situacao = "agendada";
      }
      return {
        ...c,
        porMes: meses.map((m) => cont?.porMes[m] ?? 0),
        realizadas,
        agendadas,
        ultima: cont?.ultima ?? null,
        situacao,
      };
    })
    .sort(
      (a, b) =>
        a.cluster.localeCompare(b.cluster) ||
        SITUACAO[a.situacao].ordem - SITUACAO[b.situacao].ordem ||
        a.realizadas / a.meta_mensal - b.realizadas / b.meta_mensal ||
        a.grupo_cliente.localeCompare(b.grupo_cliente)
    );

  const metaTotal = linhas.reduce((s, l) => s + l.meta_mensal, 0);
  const metaCoberta = linhas.reduce((s, l) => s + Math.min(l.realizadas, l.meta_mensal), 0);
  const cumpridas = linhas.filter((l) => l.situacao === "cumprida").length;
  const semReuniao = linhas.filter((l) => l.realizadas === 0);
  const semReuniaoComAgenda = semReuniao.filter((l) => l.agendadas > 0).length;

  // ─── Ranking: reuniões por cliente no mês (com e sem agenda) ───────────────
  const ranking = [...contagem.entries()]
    .filter(([cliente]) => !isGrupoInternoAgenda(cliente))
    .filter(([cliente]) => !cluster || clusterDe.get(cliente) === cluster)
    .map(([cliente, c]) => ({
      cliente,
      cluster: clusterDe.get(cliente) ?? null,
      noMes: c.porMes[mes] ?? 0,
      agendadas: emCurso ? c.agendadas : 0,
      em6m: meses.reduce((s, m) => s + (c.porMes[m] ?? 0), 0),
    }))
    .filter((r) => r.noMes > 0 || r.agendadas > 0)
    .sort(
      (a, b) =>
        b.noMes - a.noMes || b.em6m - a.em6m || a.cliente.localeCompare(b.cliente)
    );
  const maiorNoMes = Math.max(1, ...ranking.map((r) => r.noMes + r.agendadas));
  const foraDaAgenda = ranking.filter((r) => !r.cluster).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Dashboard Agenda Positiva
          </h1>
          <p className="text-sm text-slate-500">
            Reuniões com cada cliente contra a meta mensal do cluster
          </p>
        </div>
        {podeConfigurar && (
          <Link
            href="/configuracoes?aba=agenda"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings size={15} />
            Clusters e metas
          </Link>
        )}
      </div>

      <AgendaPositivaFiltros
        mes={mes}
        cluster={cluster}
        tipo={tipo}
        tiposReuniao={tiposReuniao}
      />

      {agenda.semTabela && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A tabela da Agenda Positiva ainda não existe no banco. Aplique a migration
          0057 para cadastrar clusters e metas.
        </p>
      )}

      {/* ─── Indicadores ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          titulo="Clientes na agenda"
          valor={String(linhas.length)}
          detalhe={
            cluster
              ? labelCluster(cluster)
              : CLUSTERS_AGENDA.map(
                  (c) => `${c.chave}: ${agenda.clientes.filter((x) => x.cluster === c.chave).length}`
                ).join(" · ")
          }
        />
        <Indicador
          titulo={`Meta de ${labelMesCurto(mes)}`}
          valor={metaTotal ? `${Math.round((metaCoberta / metaTotal) * 100)}%` : "—"}
          detalhe={
            metaTotal
              ? `${metaCoberta} de ${metaTotal} ${metaTotal === 1 ? "reunião prevista" : "reuniões previstas"}`
              : "Nenhuma meta cadastrada"
          }
        >
          {metaTotal > 0 && (
            <ProgressBar
              value={(metaCoberta / metaTotal) * 100}
              className="mt-2"
              label="Meta do mês atingida"
            />
          )}
        </Indicador>
        <Indicador
          titulo="Meta cumprida"
          valor={linhas.length ? `${cumpridas} de ${linhas.length}` : "—"}
          detalhe={linhas.length === 1 ? "cliente" : "clientes"}
          icone={<CheckCircle2 size={16} className="text-emerald-600" />}
        />
        <Indicador
          titulo="Sem reunião no mês"
          valor={String(semReuniao.length)}
          detalhe={
            semReuniaoComAgenda > 0
              ? `${semReuniaoComAgenda} com reunião agendada`
              : semReuniao.length === 1
                ? "cliente"
                : "clientes"
          }
          icone={<XCircle size={16} className="text-red-500" />}
        />
      </div>

      {/* ─── Clientes da agenda ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Clientes da agenda · últimos {MESES_NA_GRADE} meses
          </h2>
          <Legenda />
        </div>

        {linhas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <CalendarCheck size={22} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              {agenda.clientes.length === 0
                ? "Nenhum cliente com cluster e meta ainda"
                : "Nenhum cliente neste cluster"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {agenda.clientes.length === 0
                ? "Cadastre os clientes da Agenda Positiva em Configurações."
                : "Escolha outro cluster no filtro acima."}
            </p>
            {podeConfigurar && agenda.clientes.length === 0 && (
              <Link
                href="/configuracoes?aba=agenda"
                className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Cadastrar clientes
              </Link>
            )}
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Cliente</th>
                  <th className="pb-2 pr-3 text-center font-medium">Meta/mês</th>
                  {meses.map((m) => (
                    <th
                      key={m}
                      className={clsx(
                        "pb-2 text-center font-medium",
                        m === mes && "text-slate-800"
                      )}
                    >
                      {labelMesCurto(m)}
                    </th>
                  ))}
                  <th className="pb-2 pl-3 font-medium">Último contato</th>
                  <th className="pb-2 pl-3 font-medium">{labelMesCurto(mes)}</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const novoCluster = i === 0 || linhas[i - 1].cluster !== l.cluster;
                  const s = SITUACAO[l.situacao];
                  const Icone = s.icon;
                  return (
                    <Fragment key={l.grupo_cliente}>
                    {novoCluster && !cluster && (
                      <tr>
                        <td colSpan={MESES_NA_GRADE + 4} className="pb-1 pt-3">
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              CLUSTER_CLASSES[l.cluster]
                            )}
                          >
                            {CLUSTERS_AGENDA.find((c) => c.chave === l.cluster)?.label}
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-slate-100">
                      <td className="max-w-[16rem] py-2 pr-3">
                        <p className="truncate font-medium text-slate-800" title={l.grupo_cliente}>
                          {l.grupo_cliente}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-center tabular-nums text-slate-600">
                        {l.meta_mensal}
                      </td>
                      {meses.map((m, j) => {
                        const n = l.porMes[j];
                        const base = situacaoMeta(n, l.meta_mensal);
                        const estilo =
                          m === mesAtual && base !== "cumprida" ? "emCurso" : base;
                        return (
                          <td key={m} className="px-0.5 py-1.5">
                            <span
                              className={clsx(
                                "mx-auto flex h-8 w-12 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
                                CELULA[estilo],
                                m === mes && "ring-2 ring-slate-300 ring-offset-1"
                              )}
                              title={`${labelMesLongo(m)}: ${n} de ${l.meta_mensal} ${l.meta_mensal === 1 ? "reunião" : "reuniões"}${estilo === "emCurso" ? " (mês em curso)" : ""}`}
                            >
                              {n}
                            </span>
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap py-2 pl-3 text-slate-600">
                        {l.ultima ? formatDate(l.ultima) : (
                          <span className="text-slate-400">Nada em {MESES_NA_GRADE} meses</span>
                        )}
                      </td>
                      <td className="py-2 pl-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                            s.classes
                          )}
                        >
                          <Icone size={13} />
                          {s.label}
                        </span>
                        {l.agendadas > 0 && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            +{l.agendadas} {l.agendadas === 1 ? "agendada" : "agendadas"}
                          </p>
                        )}
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Reuniões por cliente ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Reuniões por cliente · <span className="capitalize">{labelMesLongo(mes)}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {ranking.length} {ranking.length === 1 ? "cliente" : "clientes"}
            {!cluster && foraDaAgenda > 0 && ` · ${foraDaAgenda} fora da agenda`}
            {" · "}sem reuniões internas do escritório
          </p>
        </div>
        {ranking.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            Nenhuma reunião com cliente neste mês.
          </p>
        ) : (
          <>
            <RankingLista itens={ranking.slice(0, RANKING_VISIVEL)} maior={maiorNoMes} />
            {ranking.length > RANKING_VISIVEL && (
              <details className="group mt-1">
                <summary className="cursor-pointer list-none py-2 text-xs font-medium text-brand-700 hover:underline">
                  <span className="group-open:hidden">
                    Ver todos os {ranking.length} clientes
                  </span>
                  <span className="hidden group-open:inline">Mostrar menos</span>
                </summary>
                <RankingLista itens={ranking.slice(RANKING_VISIVEL)} maior={maiorNoMes} />
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  icone,
  children,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icone}
        {titulo}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{valor}</p>
      <p className="text-xs text-slate-500">{detalhe}</p>
      {children}
    </div>
  );
}

function Legenda() {
  const itens = [
    { label: "Meta cumprida", classes: CELULA.cumprida },
    { label: "Abaixo da meta", classes: CELULA.parcial },
    { label: "Sem reunião", classes: CELULA.zerada },
    { label: "Mês em curso", classes: CELULA.emCurso },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {itens.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={clsx("h-3 w-3 rounded-sm", i.classes)} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function RankingLista({
  itens,
  maior,
}: {
  itens: {
    cliente: string;
    cluster: ClusterAgenda | null;
    noMes: number;
    agendadas: number;
    em6m: number;
  }[];
  maior: number;
}) {
  return (
    <ul className="space-y-1.5">
      {itens.map((r) => (
        <li
          key={r.cliente}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]"
          title={`${r.cliente}: ${r.noMes} ${r.noMes === 1 ? "realizada" : "realizadas"}${r.agendadas ? `, ${r.agendadas} ${r.agendadas === 1 ? "agendada" : "agendadas"}` : ""} · ${r.em6m} nos últimos ${MESES_NA_GRADE} meses`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm text-slate-800">{r.cliente}</span>
            {r.cluster ? (
              <span
                className={clsx(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  CLUSTER_CLASSES[r.cluster]
                )}
              >
                {r.cluster}
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">
                Fora da agenda
              </span>
            )}
          </div>
          <div className="order-last col-span-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
            <div
              className="h-full rounded-l-full bg-brand-600"
              style={{ width: `${(r.noMes / maior) * 100}%` }}
            />
            {r.agendadas > 0 && (
              <div
                className="ml-0.5 h-full bg-brand-200"
                style={{ width: `${(r.agendadas / maior) * 100}%` }}
              />
            )}
          </div>
          <span className="whitespace-nowrap text-right text-sm tabular-nums text-slate-700">
            <strong className="font-semibold">{r.noMes}</strong>
            {r.agendadas > 0 && (
              <span className="text-xs text-slate-400"> +{r.agendadas}</span>
            )}
            <span className="ml-2 text-xs text-slate-400">{r.em6m} em 6m</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
