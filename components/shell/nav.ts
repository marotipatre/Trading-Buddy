import { BookOpen, CircleHelp, Compass, FlaskConical, Layers, Lightbulb, Rocket, Wallet, Zap, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; hint: string }
/** `hue` is the one brand hue (cobalt) on every section: the site uses a single colour, plus green and red only where a number gained or lost. */
export interface NavGroup { title: string; hue: number; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { title: "Discover", hue: 264, items: [
    { href: "/dashboard", label: "Explore", icon: Compass, hint: "Today at a glance" },
    { href: "/stocks", label: "Stocks", icon: Layers, hint: "Every NSE stock, sortable" },
    { href: "/ideas", label: "Ideas", icon: Lightbulb, hint: "Swing setups and sectors" },
    { href: "/multibagger", label: "Multibagger", icon: Rocket, hint: "Small and penny stocks" },
  ] },
  { title: "Invest", hue: 264, items: [
    { href: "/portfolio", label: "Portfolio", icon: Wallet, hint: "Holdings, orders, funds" },
  ] },
  { title: "Day trade", hue: 264, items: [
    { href: "/intraday", label: "Intraday desk", icon: Zap, hint: "Daily picks, separate 5x pot" },
  ] },
  { title: "Learn", hue: 264, items: [
    { href: "/strategies", label: "Backtest", icon: FlaskConical, hint: "Test a strategy on history" },
    { href: "/playbook", label: "Rule books", icon: BookOpen, hint: "Swing and intraday rules" },
    { href: "/help", label: "Help", icon: CircleHelp, hint: "Data sources and FAQ" },
  ] },
];
export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
export const isActive = (path: string, href: string) => path.startsWith(href) || (href === "/dashboard" && path.startsWith("/trade"));

/** The section colour for a path, so a page, its header chip and its sidebar group share one hue. */
export function hueFor(path: string): number {
  for (const g of NAV_GROUPS) for (const i of g.items) if (isActive(path, i.href)) return g.hue;
  return 264;
}
export function itemFor(path: string): NavItem | undefined { return ALL_NAV.find((i) => isActive(path, i.href)); }
