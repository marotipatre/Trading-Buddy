import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Trading Buddy — Paper Trading & Backtesting",
  description: "Practise trading NSE stocks with paper money, test strategies on history, get daily ideas and follow a rule book. Free, for learning.",
  applicationName: "Trading Buddy",
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
  openGraph: { title: "Trading Buddy", description: "Paper trading, backtesting, ideas and rule books for the Indian market.", type: "website" },
  appleWebApp: { capable: true, title: "Trading Buddy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f2f4f8" }, { media: "(prefers-color-scheme: dark)", color: "#0b1020" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
