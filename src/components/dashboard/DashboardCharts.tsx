"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const CORES_TIPO = {
  Captação: "#3563eb",
  Fidelização: "#10b981",
  Relacionamento: "#f59e0b",
};
const CORES_PIE = ["#3563eb", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];

function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {empty ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Sem dados no período.
        </p>
      ) : (
        <div className="h-64 w-full">{children}</div>
      )}
    </div>
  );
}

export function DashboardCharts({
  trend,
  modalidade,
  horasPorPessoa,
  ranking,
}: {
  trend: {
    mes: string;
    Captação: number;
    Fidelização: number;
    Relacionamento: number;
  }[];
  modalidade: { name: string; value: number }[];
  horasPorPessoa: { nome: string; horas: number }[];
  ranking: { nome: string; qtd: number }[];
}) {
  const trendVazio = trend.every(
    (t) => t.Captação + t.Fidelização + t.Relacionamento === 0
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Reuniões por tipo ao longo do tempo */}
      <ChartCard title="Reuniões por tipo ao longo do tempo" empty={trendVazio}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {(["Captação", "Fidelização", "Relacionamento"] as const).map((k) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={CORES_TIPO[k]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Distribuição por modalidade */}
      <ChartCard
        title="Distribuição por modalidade"
        empty={modalidade.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={modalidade}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
            >
              {modalidade.map((_, i) => (
                <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Horas por pessoa */}
      <ChartCard
        title="Horas internas por pessoa"
        empty={horasPorPessoa.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={horasPorPessoa}
            layout="vertical"
            margin={{ top: 5, right: 10, bottom: 0, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis
              type="category"
              dataKey="nome"
              width={110}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <Tooltip formatter={(v: number) => `${v}h`} />
            <Bar dataKey="horas" fill="#2447d0" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Ranking de reuniões por pessoa */}
      <ChartCard
        title="Ranking de reuniões por pessoa"
        empty={ranking.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ranking}
            layout="vertical"
            margin={{ top: 5, right: 10, bottom: 0, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis
              type="category"
              dataKey="nome"
              width={110}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <Tooltip />
            <Bar dataKey="qtd" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
