import { BookOpen, CircleHelp, Compass, FlaskConical, Layers, Lightbulb, Rocket, Wallet, Zap, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; hint: string }
export interface NavGroup { title: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { title: "Discover", items: [
    { href: "/dashboard", label: "Explore", icon: Compass, hint: "Today at a glance" },
    { href: "/stocks", label: "Stocks", icon: Layers, hint: "Every NSE stock, sortable" },
    { href: "/ideas", label: "Ideas", icon: Lightbulb, hint: "Swing setups and sectors" },
    { href: "/multibagger", label: "Multibagger", icon: Rocket, hint: "Small and penny stocks" },
  ] },
  { title: "Invest", items: [
    { href: "/portfolio", label: "Portfolio", icon: Wallet, hint: "Holdings, orders, funds" },
  ] },
  { title: "Day trade", items: [
    { href: "/intraday", label: "Intraday desk", icon: Zap, hint: "Daily picks, separate 5x pot" },
  ] },
  { title: "Learn", items: [
    { href: "/strategies", label: "Backtest", icon: FlaskConical, hint: "Test a strategy on history" },
    { href: "/playbook", label: "Rule books", icon: BookOpen, hint: "Swing and intraday rules" },
    { href: "/help", label: "Help", icon: CircleHelp, hint: "Data sources and FAQ" },
  ] },
];
export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
export const isActive = (path: string, href: string) => path.startsWith(href) || (href === "/dashboard" && path.startsWith("/trade"));
