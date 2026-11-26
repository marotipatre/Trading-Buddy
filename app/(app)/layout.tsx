import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { PaperProvider } from "@/components/paper/paper-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PaperProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 lg:px-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </PaperProvider>
  );
}
