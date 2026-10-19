import { useMemo, type ReactNode, type ReactElement } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { PageHeader } from "../components/ui/PageHeader";
import { useRegistry } from "../providers/RegistryProvider";
import { useRisk } from "../hooks/useRisk";

const PALETTE = ["#7c6cff", "#49b6ff", "#19cb8a", "#f6b445", "#fb5b73", "#a78bfa"];
const STATUS_COLOR: Record<string, string> = { Registered: "#19cb8a", Pending: "#f6b445", Rejected: "#fb5b73" };

function groupCount<T>(items: T[], key: (t: T) => string) {
  const m: Record<string, number> = {};
  items.forEach((i) => { const k = key(i); if (k) m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([name, value]) => ({ name, value }));
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-display text-sm font-semibold">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">{children as ReactElement}</ResponsiveContainer>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
  fontSize: 12,
};

export default function Analytics() {
  const { snapshot } = useRegistry();
  const { ranked } = useRisk();

  const active = snapshot.properties.filter((p) => p.onChainStatus !== "Reverted");

  const byStatus = useMemo(() => groupCount(active, (p) => p.onChainStatus), [active]);
  const byCity = useMemo(() => groupCount(active, (p) => p.city).sort((a, b) => b.value - a.value), [active]);
  const byType = useMemo(() => groupCount(active, (p) => p.property_type), [active]);
  const riskDist = useMemo(() => {
    const m = { Low: 0, Medium: 0, High: 0 };
    ranked.forEach((r) => { m[r.risk.level]++; });
    return [{ name: "Low", value: m.Low }, { name: "Medium", value: m.Medium }, { name: "High", value: m.High }];
  }, [ranked]);

  const transfersOverTime = useMemo(() => {
    const m: Record<string, number> = {};
    snapshot.transfers.filter((t) => t.outcome === "Completed").forEach((t) => {
      const k = t.date.slice(0, 7);
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).sort().map((k) => ({ month: k, transfers: m[k] }));
  }, [snapshot]);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Registry composition, activity over time and the distribution of off-chain risk." />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Properties by status">
          <PieChart>
            <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
              {byStatus.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name] ?? "#7c6cff"} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Risk distribution">
          <BarChart data={riskDist}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface)" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {riskDist.map((d) => <Cell key={d.name} fill={d.name === "High" ? "#fb5b73" : d.name === "Medium" ? "#f6b445" : "#19cb8a"} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Properties by city">
          <BarChart data={byCity} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface)" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#7c6cff" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Properties by type">
          <PieChart>
            <Pie data={byType} dataKey="value" nameKey="name" outerRadius={85} label>
              {byType.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Completed transfers over time">
            <AreaChart data={transfersOverTime}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c6cff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#7c6cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="transfers" stroke="#7c6cff" strokeWidth={2} fill="url(#tg)" />
            </AreaChart>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
