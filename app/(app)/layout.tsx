import { AlertsProvider } from "@/components/alerts/alerts-provider";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { CommandPalette } from "@/components/command-palette";
import { MobileNav } from "@/components/mobile-nav";
import { PaperProvider } from "@/components/paper/paper-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PaperProvider>
      <AlertsProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
        <AppHeader />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="mx-auto outline-none w-full max-w-7xl flex-1 px-4 py-6 pb-24 lg:px-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
      <CommandPalette />
      </AlertsProvider>
    </PaperProvider>
  );
}
