import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Ruler, Building2 } from "lucide-react";
import type { IndexedProperty } from "../types";
import { StatusPill, RiskBadge } from "./ui/primitives";
import { shortAddr } from "../lib/utils";
import { useRisk } from "../hooks/useRisk";

export function PropertyCard({ p, index = 0 }: { p: IndexedProperty; index?: number }) {
  const { score } = useRisk();
  const risk = score(p.property_ref);
  const to = p.onChainId ? `/property/${p.onChainId}` : "/explorer";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -4 }}
      className="card group flex flex-col p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mono text-xs text-muted">{p.property_ref}</p>
          <h3 className="truncate font-display text-base font-semibold">{p.location}</h3>
        </div>
        <StatusPill status={p.onChainStatus} />
      </div>

      <div className="space-y-1.5 text-sm text-muted">
        {p.city && (
          <p className="flex items-center gap-2">
            <MapPin size={14} /> {p.city}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Building2 size={14} /> {p.property_type}
        </p>
        <p className="flex items-center gap-2">
          <Ruler size={14} /> {p.area_sqm.toLocaleString()} m²
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="mono text-xs text-muted">owner {shortAddr(p.ownerAddress)}</span>
        {risk.score > 0 ? <RiskBadge level={risk.level} score={risk.score} /> : <span className="pill pill-emerald">clean</span>}
      </div>

      <Link
        to={to}
        className="mt-4 text-center text-sm font-semibold text-primary opacity-0 transition group-hover:opacity-100"
      >
        View details →
      </Link>
    </motion.div>
  );
}
