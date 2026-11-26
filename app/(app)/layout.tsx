import { AlertsProvider } from "@/components/alerts/alerts-provider";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { CommandPalette } from "@/components/command-palette";
import { MobileNav } from "@/components/mobile-nav";
import { PaperProvider } from "@/components/paper/paper-provider";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PaperProvider>
      <AlertsProvider>
        <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
        <Sidebar />
        <div className="flex min-h-screen flex-col lg:pl-60">
          <AppHeader />
          <OfflineBanner />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[88rem] flex-1 px-4 py-7 pb-24 outline-none lg:px-8 lg:pb-10">{children}</main>
        </div>
        <MobileNav />
        <CommandPalette />
      </AlertsProvider>
    </PaperProvider>
  );
}
