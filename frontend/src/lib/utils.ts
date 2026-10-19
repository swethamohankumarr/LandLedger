import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 0x1234…abcd */
export function shortAddr(addr?: string | null, size = 4): string {
  if (!addr) return "—";
  if (addr.length <= 2 + size * 2) return addr;
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

/** Human date from an ISO string or a unix-seconds value. */
export function formatDate(value: string | number | bigint): string {
  let ms: number;
  if (typeof value === "string") ms = new Date(value).getTime();
  else ms = Number(value) * 1000;
  if (!ms || Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | number | bigint): string {
  let ms: number;
  if (typeof value === "string") ms = new Date(value).getTime();
  else ms = Number(value) * 1000;
  if (!ms || Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error("Clipboard unavailable"));
}

export const STATUS_META: Record<
  string,
  { label: string; pill: string; dot: string }
> = {
  Registered: { label: "Registered", pill: "pill-emerald", dot: "var(--emerald)" },
  Pending: { label: "Pending", pill: "pill-amber", dot: "var(--amber)" },
  Rejected: { label: "Rejected", pill: "pill-rose", dot: "var(--rose)" },
  Reverted: { label: "Reverted", pill: "pill-rose", dot: "var(--rose)" },
};

export function statusFromCode(code: number): "Pending" | "Registered" | "Rejected" {
  return (["Pending", "Registered", "Rejected"] as const)[code] ?? "Pending";
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Prefixes a root-relative asset path with the app's base URL so static assets
 * and demo documents resolve correctly when hosted under a sub-path
 * (e.g. GitHub Pages at /LandLedger/). Absolute http(s) URLs pass through.
 */
export function withBase(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}
