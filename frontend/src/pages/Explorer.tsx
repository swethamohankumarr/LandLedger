import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, Download, LayoutGrid, Table2, ArrowUpDown } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill, RiskBadge, EmptyState } from "../components/ui/primitives";
import { PropertyCard } from "../components/PropertyCard";
import { useRegistry } from "../providers/RegistryProvider";
import { useRisk } from "../hooks/useRisk";
import { shortAddr } from "../lib/utils";

type SortKey = "ref" | "city" | "area" | "status" | "risk";

export default function Explorer() {
  const { snapshot } = useRegistry();
  const { score } = useRisk();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [city, setCity] = useState("All");
  const [type, setType] = useState("All");
  const [view, setView] = useState<"table" | "cards">("table");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "ref", dir: 1 });
  const [page, setPage] = useState(0);
  const PER = 10;

  const cities = useMemo(() => ["All", ...Array.from(new Set(snapshot.properties.map((p) => p.city).filter(Boolean)))], [snapshot]);
  const types = useMemo(() => ["All", ...Array.from(new Set(snapshot.properties.map((p) => p.property_type).filter(Boolean)))], [snapshot]);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = snapshot.properties.filter((p) => p.onChainStatus !== "Reverted");
    if (status !== "All") list = list.filter((p) => p.onChainStatus === status);
    if (city !== "All") list = list.filter((p) => p.city === city);
    if (type !== "All") list = list.filter((p) => p.property_type === type);
    if (ql)
      list = list.filter(
        (p) =>
          p.property_ref.toLowerCase().includes(ql) ||
          p.location.toLowerCase().includes(ql) ||
          p.survey_number.toLowerCase().includes(ql) ||
          p.ownerAddress.toLowerCase().includes(ql)
      );
    const withRisk = list.map((p) => ({ p, r: score(p.property_ref) }));
    withRisk.sort((a, b) => {
      const dir = sort.dir;
      switch (sort.key) {
        case "city": return a.p.city.localeCompare(b.p.city) * dir;
        case "area": return (a.p.area_sqm - b.p.area_sqm) * dir;
        case "status": return a.p.onChainStatus.localeCompare(b.p.onChainStatus) * dir;
        case "risk": return (a.r.score - b.r.score) * dir;
        default: return a.p.property_ref.localeCompare(b.p.property_ref) * dir;
      }
    });
    return withRisk;
  }, [snapshot, q, status, city, type, sort, score]);

  const pages = Math.ceil(rows.length / PER) || 1;
  const pageRows = rows.slice(page * PER, page * PER + PER);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const exportCsv = () => {
    const header = ["ref", "location", "city", "type", "area_sqm", "survey", "status", "owner", "risk_score", "risk_level"];
    const lines = rows.map(({ p, r }) =>
      [p.property_ref, `"${p.location}"`, p.city, p.property_type, p.area_sqm, p.survey_number, p.onChainStatus, p.ownerAddress, r.score, r.level].join(",")
    );
    const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registry-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Registry Explorer"
        subtitle="Search, filter and sort every property on record. Export the current view as CSV."
        actions={
          <>
            <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
              <button onClick={() => setView("table")} className={`rounded-lg p-2 ${view === "table" ? "bg-[var(--primary-soft)] text-primary" : "text-muted"}`} aria-label="Table view"><Table2 size={16} /></button>
              <button onClick={() => setView("cards")} className={`rounded-lg p-2 ${view === "cards" ? "bg-[var(--primary-soft)] text-primary" : "text-muted"}`} aria-label="Card view"><LayoutGrid size={16} /></button>
            </div>
            <button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          </>
        }
      />

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search ref, location, survey, owner…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <Select value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={["All", "Registered", "Pending", "Rejected"]} label="Status" />
        <Select value={city} onChange={(v) => { setCity(v); setPage(0); }} options={cities} label="City" />
        <Select value={type} onChange={(v) => { setType(v); setPage(0); }} options={types} label="Type" />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No matches" message="Try clearing a filter or searching a different term." />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageRows.map(({ p }, i) => <PropertyCard key={p.property_ref} p={p} index={i} />)}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <Th onClick={() => toggleSort("ref")}>Ref</Th>
                  <th className="p-3">Location</th>
                  <Th onClick={() => toggleSort("city")}>City</Th>
                  <th className="p-3">Type</th>
                  <Th onClick={() => toggleSort("area")}>Area</Th>
                  <Th onClick={() => toggleSort("status")}>Status</Th>
                  <th className="p-3">Owner</th>
                  <Th onClick={() => toggleSort("risk")}>Risk</Th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ p, r }) => (
                  <tr key={p.property_ref} className="border-b border-border transition hover:bg-surface">
                    <td className="mono p-3 text-xs">{p.property_ref}</td>
                    <td className="max-w-[200px] truncate p-3">{p.location}</td>
                    <td className="p-3">{p.city || "—"}</td>
                    <td className="p-3">{p.property_type}</td>
                    <td className="p-3">{p.area_sqm.toLocaleString()} m²</td>
                    <td className="p-3"><StatusPill status={p.onChainStatus} /></td>
                    <td className="mono p-3 text-xs">{shortAddr(p.ownerAddress)}</td>
                    <td className="p-3">{r.score > 0 ? <RiskBadge level={r.level} score={r.score} /> : <span className="pill pill-emerald">clean</span>}</td>
                    <td className="p-3">{p.onChainId && <Link to={`/property/${p.onChainId}`} className="font-semibold text-primary hover:underline">View</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{rows.length} properties</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !py-1.5" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
          <span>Page {page + 1} / {pages}</span>
          <button className="btn btn-ghost !py-1.5" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next</button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <th className="cursor-pointer select-none p-3 transition hover:text-ink" onClick={onClick}>
      <span className="inline-flex items-center gap-1">{children} <ArrowUpDown size={12} /></span>
    </th>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map((o) => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  );
}
