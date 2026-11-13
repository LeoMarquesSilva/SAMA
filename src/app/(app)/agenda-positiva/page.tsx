import Link from "next/link";
import { clsx } from "clsx";
import {
  CalendarCheck,
  Settings,
  Target,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { requireModulo } from "@/lib/auth";
import { getModulosAtuais } from "@/lib/currentPessoa";
import { temModulo } from "@/lib/modulos";
import { formatDate } from "@/lib/format";
import { listarTiposReuniao } from "@/lib/reuniao-tipos.server";
import {
  listarAgendaPositiva,
  listarGruposCliente,
  reunioesPorCliente,
} from "@/lib/agenda-positiva.server";
import {
  CLUSTER_CLASSES,
  FILTRO_SEM_CLUSTER,
  isGrupoInternoAgenda,
  labelCluster,
  labelMesCurto,
  labelMesLongo,
  labelMesTitulo,
  mesAtualKey,
  mesesAte,
  parseFiltroCluster,
  parseMesKey,
  somarMeses,
  type LinhaGrupoAgenda,
  type SituacaoGrupo,
} from "@/lib/agenda-positiva";
import { AgendaPositivaFiltros } from "@/components/agenda-positiva/AgendaPositivaFiltros";
import { AgendaPositivaTabela } from "@/components/agenda-positiva/AgendaPositivaTabela";

export const dynamic = "force-dynamic";

const MESES_NA_GRADE = 6;
const TOP_NO_MES = 8;

type Contagem = {
  porMes: Record<string, number>;
  /** Agendadas (ainda não realizadas) no mês escolhido. */
  agendadas: number;
  ultima: string | null;
};

/** Sem meta, uma reunião no mês já basta. */
function situacaoDoGrupo(
  realizadas: number,
  agendadas: number,
  meta: number | null
): SituacaoGrupo {
  const alvo = meta ?? 1;
  if (realizadas >= alvo) return meta ? "cumprida" : "realizada";
  if (realizadas + agendadas >= alvo) return "agendada";
  return realizadas > 0 ? "parcial" : "zerada";
}

function pct(parte: number, total: number): string {
  return total ? `${Math.round((parte / total) * 100)}%` : "—";
}

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
  const cluster = parseFiltroCluster(sp.cluster);
  const tipo = sp.tipo || "";
  const meses = mesesAte(mes, MESES_NA_GRADE);
  const emCurso = mes === mesAtual;

  const [agenda, grupos, reunioes, tiposReuniao, modulos] = await Promise.all([
    listarAgendaPositiva(),
    listarGruposCliente(),
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

  // ─── Todos os grupos do escritório, com ou sem cluster ─────────────────────
  // Entram também os da agenda (mesmo que o grupo tenha sumido do VIOS) e os
  // clientes sem grupo que tiveram reunião (a reunião fica no nome do cadastro).
  const daAgenda = new Map(agenda.clientes.map((c) => [c.grupo_cliente, c]));
  const nomesDeGrupo = new Set([...grupos, ...daAgenda.keys()]);
  const universo = new Set(nomesDeGrupo);
  for (const cliente of contagem.keys()) {
    if (!isGrupoInternoAgenda(cliente)) universo.add(cliente);
  }

  const todas: LinhaGrupoAgenda[] = [...universo].map((grupo) => {
    const cfg = daAgenda.get(grupo);
    const cont = contagem.get(grupo);
    const porMes = meses.map((m) => cont?.porMes[m] ?? 0);
    const realizadas = cont?.porMes[mes] ?? 0;
    const agendadas = emCurso ? cont?.agendadas ?? 0 : 0;
    const meta = cfg?.meta_mensal ?? null;
    const ultima = cont?.ultima ?? null;
    return {
      grupo,
      cluster: cfg?.cluster ?? null,
      meta,
      porMes,
      realizadas,
      agendadas,
      total: porMes.reduce((s, n) => s + n, 0),
      ultima,
      ultimaLabel: ultima ? formatDate(ultima) : null,
      situacao: situacaoDoGrupo(realizadas, agendadas, meta),
      semGrupo: !nomesDeGrupo.has(grupo),
    };
  });

  const linhas = todas.filter((l) =>
    !cluster ? true : cluster === FILTRO_SEM_CLUSTER ? !l.cluster : l.cluster === cluster
  );

  // ─── Indicadores ───────────────────────────────────────────────────────────
  const total = linhas.length;
  const comReuniao = linhas.filter((l) => l.realizadas > 0).length;
  const semReuniao = total - comReuniao;
  const semReuniaoComAgenda = linhas.filter((l) => l.realizadas === 0 && l.agendadas > 0).length;
  const nadaNoPeriodo = linhas.filter((l) => l.total === 0).length;
  const reunioesNoMes = linhas.reduce((s, l) => s + l.realizadas, 0);
  const agendadasNoMes = linhas.reduce((s, l) => s + l.agendadas, 0);
  const mesAnterior = somarMeses(mes, -1);
  const iAnterior = meses.indexOf(mesAnterior);
  const reunioesMesAnterior = linhas.reduce((s, l) => s + (l.porMes[iAnterior] ?? 0), 0);
  const comMeta = linhas.filter((l) => l.meta);
  const metaTotal = comMeta.reduce((s, l) => s + (l.meta ?? 0), 0);
  const metaCoberta = comMeta.reduce((s, l) => s + Math.min(l.realizadas, l.meta ?? 0), 0);
  const cumpridas = comMeta.filter((l) => l.situacao === "cumprida").length;

  // ─── Evolução e destaques ──────────────────────────────────────────────────
  const evolucao = meses.map((m, j) => ({
    mes: m,
    reunioes: linhas.reduce((s, l) => s + l.porMes[j], 0),
    grupos: linhas.filter((l) => l.porMes[j] > 0).length,
  }));
  const maiorMes = Math.max(1, ...evolucao.map((e) => e.reunioes));

  const top = linhas
    .filter((l) => l.realizadas > 0 || l.agendadas > 0)
    .sort(
      (a, b) =>
        b.realizadas - a.realizadas ||
        b.agendadas - a.agendadas ||
        b.total - a.total ||
        a.grupo.localeCompare(b.grupo, "pt-BR")
    )
    .slice(0, TOP_NO_MES);
  const maiorTop = Math.max(1, ...top.map((r) => r.realizadas + r.agendadas));

  const recorte =
    cluster === FILTRO_SEM_CLUSTER ? "sem cluster" : cluster ? labelCluster(cluster) : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Dashboard Agenda Positiva
          </h1>
          <p className="text-sm text-slate-500">
            Reuniões com cada grupo cliente do escritório, com ou sem meta de cluster
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
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Grupos com reunião no mês"
          valor={total ? `${comReuniao} de ${total}` : "—"}
          dica={`${pct(comReuniao, total)} dos grupos${recorte ? ` · ${recorte}` : ""}`}
          icone={Users}
          destaque="bg-emerald-100 text-emerald-700"
        />
        <Indicador
          titulo="Grupos sem reunião no mês"
          valor={String(semReuniao)}
          dica={[
            semReuniaoComAgenda > 0 &&
              `${semReuniaoComAgenda} com reunião agendada`,
            `${nadaNoPeriodo} sem nenhuma em ${MESES_NA_GRADE} meses`,
          ]
            .filter(Boolean)
            .join(" · ")}
          icone={XCircle}
          destaque="bg-rose-100 text-rose-700"
        />
        <Indicador
          titulo="Reuniões realizadas no mês"
          valor={String(reunioesNoMes)}
          dica={[
            agendadasNoMes > 0 && `+${agendadasNoMes} agendadas`,
            `${reunioesMesAnterior} em ${labelMesCurto(mesAnterior)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          icone={CalendarCheck}
          destaque="bg-slate-100 text-slate-700"
        />
        <Indicador
          titulo="Meta do mês atingida"
          valor={metaTotal ? pct(metaCoberta, metaTotal) : "—"}
          dica={
            metaTotal
              ? `${cumpridas} de ${comMeta.length} grupos com meta · ${metaCoberta} de ${metaTotal} reuniões`
              : "Nenhum grupo com meta neste recorte"
          }
          meta={metaTotal ? "100%" : undefined}
          atingiuMeta={metaTotal ? metaCoberta >= metaTotal : null}
          icone={Target}
          destaque="bg-sky-100 text-sky-700"
        />
      </div>

      {/* ─── Evolução e destaques ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              Evolução · últimos {MESES_NA_GRADE} meses
            </h2>
            <p className="text-xs text-slate-500">
              Reuniões realizadas e grupos atendidos em cada mês
            </p>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-3">
            {evolucao.map((e) => (
              <div
                key={e.mes}
                className="flex min-w-0 flex-col items-center"
                title={`${labelMesLongo(e.mes)}: ${e.reunioes} ${e.reunioes === 1 ? "reunião" : "reuniões"}, ${e.grupos} de ${total} grupos${e.mes === mesAtual ? " (mês em curso)" : ""}`}
              >
                <span className="text-sm font-semibold tabular-nums text-slate-800">
                  {e.reunioes}
                </span>
                <div className="mt-1 flex h-28 w-full items-end justify-center border-b border-slate-200">
                  <div
                    className={clsx(
                      "w-full max-w-[2.75rem] rounded-t-md",
                      e.mes === mes ? "bg-brand-600" : "bg-brand-200",
                      e.mes === mesAtual && e.mes !== mes && "opacity-60"
                    )}
                    style={{ height: `${Math.max(2, (e.reunioes / maiorMes) * 100)}%` }}
                  />
                </div>
                <span
                  className={clsx(
                    "mt-1.5 text-xs font-medium",
                    e.mes === mes ? "text-slate-800" : "text-slate-500"
                  )}
                >
                  {labelMesCurto(e.mes)}
                </span>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {e.grupos} {e.grupos === 1 ? "grupo" : "grupos"}
                </span>
                <span className="text-[11px] tabular-nums text-slate-400">
                  {pct(e.grupos, total)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Mais reuniões em {labelMesTitulo(mes)}
          </h2>
          {top.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
              Nenhuma reunião com cliente neste mês.
            </p>
          ) : (
            <ul className="space-y-2">
              {top.map((r) => (
                <li
                  key={r.grupo}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
                  title={`${r.grupo}: ${r.realizadas} ${r.realizadas === 1 ? "realizada" : "realizadas"}${r.agendadas ? `, ${r.agendadas} ${r.agendadas === 1 ? "agendada" : "agendadas"}` : ""} · ${r.total} nos últimos ${MESES_NA_GRADE} meses`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {r.cluster && (
                      <span
                        className={clsx(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          CLUSTER_CLASSES[r.cluster]
                        )}
                      >
                        {r.cluster}
                      </span>
                    )}
                    <span className="truncate text-sm text-slate-800">{r.grupo}</span>
                  </div>
                  <span className="whitespace-nowrap text-right text-sm tabular-nums text-slate-700">
                    <strong className="font-semibold">{r.realizadas}</strong>
                    {r.agendadas > 0 && (
                      <span className="text-xs text-slate-400"> +{r.agendadas}</span>
                    )}
                  </span>
                  <div className="col-span-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-l-full bg-brand-600"
                      style={{ width: `${(r.realizadas / maiorTop) * 100}%` }}
                    />
                    {r.agendadas > 0 && (
                      <div
                        className="ml-0.5 h-full bg-brand-200"
                        style={{ width: `${(r.agendadas / maiorTop) * 100}%` }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ─── Todos os grupos ─────────────────────────────────────────────────── */}
      <AgendaPositivaTabela linhas={linhas} meses={meses} mes={mes} mesAtual={mesAtual} />
    </div>
  );
}

/** Card de indicador no mesmo desenho dos indicadores do SIOE (Eficiência). */
function Indicador({
  titulo,
  valor,
  dica,
  meta,
  atingiuMeta = null,
  icone: Icone,
  destaque,
}: {
  titulo: string;
  valor: string;
  dica?: string;
  meta?: string;
  /** null: sem meta para comparar (texto cinza). */
  atingiuMeta?: boolean | null;
  icone: LucideIcon;
  /** Fundo e cor do quadrado do ícone (ex.: "bg-emerald-100 text-emerald-700"). */
  destaque: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            destaque
          )}
        >
          <Icone size={16} aria-hidden />
        </span>
        <h3 className="min-w-0 truncate text-xs font-medium text-slate-500" title={titulo}>
          {titulo}
        </h3>
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{valor}</p>
      {(dica || meta) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-1.5 text-xs">
          {dica && <span className="text-slate-400">{dica}</span>}
          {meta && (
            <span
              className={clsx(
                "font-medium",
                atingiuMeta == null
                  ? "text-slate-400"
                  : atingiuMeta
                    ? "text-emerald-600"
                    : "text-amber-600"
              )}
            >
              meta: {meta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
