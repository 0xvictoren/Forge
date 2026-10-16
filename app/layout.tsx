import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { ShelbyProvider } from "@/components/providers/shelby-provider";
import { AppProvider } from "@/components/providers/app-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WalletSessionSync } from "@/components/providers/wallet-session-sync";
import { GlassFilters } from "@/components/glass/glass-filters";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Forge · Data that proves itself",
    template: "%s · Forge",
  },
  applicationName: "Forge",
  description:
    "License AI training data with cryptographic provenance. Encrypted on Shelby, sealed and settled on Aptos, fingerprinted for every buyer, with an EU AI Act training-data record built in.",
  icons: {
    icon: [{ url: "/favicon.webp", type: "image/webp" }],
    apple: [{ url: "/favicon.webp", type: "image/webp" }],
    shortcut: "/favicon.webp",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('forge-theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider>
            <WalletProvider>
              <ShelbyProvider>
                <AppProvider>
                  <WalletSessionSync />
                  <GlassFilters />
                  {children}
                  <Toaster position="top-center" closeButton toastOptions={{ className: "forge-toast" }} />
                </AppProvider>
              </ShelbyProvider>
            </WalletProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
