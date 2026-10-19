import {
  LayoutDashboard,
  FilePlus2,
  ShieldCheck,
  ArrowLeftRight,
  Table2,
  BarChart3,
  AlertTriangle,
  SearchCheck,
  Info,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only shown to registrar/admin wallets. */
  roleGated?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/register", label: "Register Property", icon: FilePlus2 },
  { to: "/registrar", label: "Registrar Console", icon: ShieldCheck, roleGated: true },
  { to: "/transfers", label: "Transfer Center", icon: ArrowLeftRight },
  { to: "/explorer", label: "Registry Explorer", icon: Table2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/fraud", label: "Fraud Alerts", icon: AlertTriangle },
  { to: "/verify", label: "Public Verify", icon: SearchCheck },
  { to: "/about", label: "About / Architecture", icon: Info },
];
