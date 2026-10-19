import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { cn, shortAddr, copyToClipboard, STATUS_META } from "../../lib/utils";
import type { RiskLevel } from "../../lib/riskScore";

/* -------------------------------------------------- Status pill */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.Pending;
  return (
    <span className={cn("pill", meta.pill, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

/* -------------------------------------------------- Risk badge */
const RISK_PILL: Record<RiskLevel, string> = {
  Low: "pill-emerald",
  Medium: "pill-amber",
  High: "pill-rose",
};
export function RiskBadge({ level, score, className }: { level: RiskLevel; score?: number; className?: string }) {
  return (
    <span className={cn("pill", RISK_PILL[level], className)}>
      {level} risk{typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

/* -------------------------------------------------- Skeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}
export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-5">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/* -------------------------------------------------- Empty state */
export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mb-4 opacity-80">{icon ?? <DefaultEmptyArt />}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function DefaultEmptyArt() {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden>
      <rect x="18" y="20" width="60" height="42" rx="6" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M18 32 H78" stroke="var(--primary)" strokeOpacity="0.3" strokeWidth="2" />
      <circle cx="48" cy="14" r="7" stroke="var(--emerald)" strokeWidth="2" />
      <path d="M44 14l3 3 5-6" stroke="var(--emerald)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------- Count up */
export function CountUp({ value, duration = 1.2, className }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);
  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}

/* -------------------------------------------------- Sparkline */
export function Sparkline({ data, color = "var(--primary)", width = 120, height = 36 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / span) * (height - 4) - 2}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

/* -------------------------------------------------- Copy chip (address / hash) */
export function CopyChip({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await copyToClipboard(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* ignore */
        }
      }}
      className={cn(
        "mono inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs transition hover:bg-[var(--surface-strong)]",
        className
      )}
      title={value}
      aria-label={`Copy ${label ?? "value"}`}
    >
      {label ?? shortAddr(value, 5)}
      {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} className="text-muted" />}
    </button>
  );
}

/* -------------------------------------------------- Motion card */
export function MotionCard({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn("card", className)}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------- Spinner */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}
