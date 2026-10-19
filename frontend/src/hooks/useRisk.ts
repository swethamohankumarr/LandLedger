import { useMemo } from "react";
import { useRegistry } from "../providers/RegistryProvider";
import { scoreAll, scoreProperty, RiskResult, RiskContext } from "../lib/riskScore";
import type { IndexedProperty } from "../types";

export interface RankedRisk {
  property: IndexedProperty;
  risk: RiskResult;
}

export function useRisk() {
  const { snapshot } = useRegistry();
  const ctx: RiskContext = useMemo(
    () => ({ properties: snapshot.properties, transfers: snapshot.transfers }),
    [snapshot]
  );
  const ranked = useMemo(() => scoreAll(ctx), [ctx]);
  const byRef = useMemo(() => {
    const m = new Map<string, RiskResult>();
    ranked.forEach((r) => m.set(r.property.property_ref, r.risk));
    return m;
  }, [ranked]);
  const score = (ref: string) => byRef.get(ref) ?? scoreProperty(ref, ctx);
  return { ranked, byRef, score, ctx };
}
