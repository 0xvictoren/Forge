import type { Metadata } from "next";
import { Barlow_Condensed, Outfit } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { ShelbyProvider } from "@/components/providers/shelby-provider";
import { AppProvider } from "@/components/providers/app-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WalletSessionSync } from "@/components/providers/wallet-session-sync";
import { Toaster } from "sonner";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Forge",
  applicationName: "Forge",
  description: "A Web3 creator platform on Aptos ShelbyNet for gated media sharing, wallet-native payments, and certificates of ownership. No traditional signups.",
  icons: {
    icon: [{ url: "/favicon.webp", type: "image/webp" }],
    apple: [{ url: "/favicon.webp", type: "image/webp" }],
    shortcut: "/favicon.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${barlowCondensed.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('forge-theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen overflow-hidden" suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider>
            <WalletProvider>
              <ShelbyProvider>
                <AppProvider>
                  <WalletSessionSync />
                  {children}
                  <Toaster position="top-center" richColors closeButton />
                </AppProvider>
              </ShelbyProvider>
            </WalletProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
