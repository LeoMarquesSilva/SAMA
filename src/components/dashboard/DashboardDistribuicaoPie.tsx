"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

type Slice = { name: string; value: number; color: string };

function pct(value: number, total: number): string {
  if (total <= 0) return "0%";
  const n = (value / total) * 100;
  return n < 1 && n > 0
    ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : `${Math.round(n).toLocaleString("pt-BR")}%`;
}

function slicePctLabel(percent: number): string {
  const n = percent * 100;
  if (n < 1 && n > 0) {
    return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return `${Math.round(n).toLocaleString("pt-BR")}%`;
}

function labelFontSize(percent: number): number {
  if (percent >= 0.2) return 12;
  if (percent >= 0.12) return 11;
  if (percent >= 0.08) return 10;
  if (percent >= 0.05) return 9;
  if (percent >= 0.03) return 8;
  return 7;
}

function renderSliceLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const cxN = Number(cx);
  const cyN = Number(cy);
  const innerN = Number(innerRadius);
  const outerN = Number(outerRadius);
  const angleN = Number(midAngle);

  if (
    !Number.isFinite(cxN) ||
    !Number.isFinite(cyN) ||
    !Number.isFinite(angleN) ||
    !Number.isFinite(innerN) ||
    !Number.isFinite(outerN) ||
    !percent
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const ring = outerN - innerN;
  const pos = percent < 0.06 ? 0.68 : 0.52;
  const radius = innerN + ring * pos;
  const x = cxN + radius * Math.cos(-angleN * RADIAN);
  const y = cyN + radius * Math.sin(-angleN * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={labelFontSize(percent)}
      fontWeight={700}
      style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
    >
      {slicePctLabel(percent)}
    </text>
  );
}

export function DashboardDistribuicaoPie({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((s, t) => s + t.value, 0);
  const data: Slice[] = items
    .filter((i) => i.value > 0)
    .map((i) => ({
      name: i.label,
      value: i.value,
      color: i.color,
    }));

  return (
    <section className="flex h-full min-h-[22rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 md:p-5 lg:min-h-[28rem]">
      <h2 className="mb-4 text-center text-sm font-semibold text-slate-700">
        Agenda por categoria
      </h2>

      {data.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Sem dados no período.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative h-56 w-full min-w-0 flex-1 lg:h-64 xl:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="76%"
                  paddingAngle={0.5}
                  label={renderSliceLabel}
                  labelLine={false}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, item) => {
                    const label = item.payload?.name ?? "";
                    return [`${value} · ${pct(value, total)}`, label];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-2xl font-bold tabular-nums leading-none text-slate-800 md:text-3xl">
                {total.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          <ul className="grid max-h-48 shrink-0 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:max-h-none lg:w-44 lg:grid-cols-1 xl:w-52">
            {data.map(({ name, value, color }) => (
              <li
                key={name}
                className="flex items-start gap-2 text-[11px] leading-tight text-slate-600"
              >
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>
                  <span className="font-medium text-slate-700">{name}</span>
                  <span className="text-slate-400"> · {pct(value, total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
