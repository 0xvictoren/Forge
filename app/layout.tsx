import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { ShelbyProvider } from "@/components/providers/shelby-provider";
import { AppProvider } from "@/components/providers/app-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { WalletSessionSync } from "@/components/providers/wallet-session-sync";
import { Toaster } from "sonner";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Forge — Web3 Creative Platform",
  description: "Discover creators, hire talent, and monetise work on Aptos with Shelby storage.",
  icons: {
    icon: "/logo.webp",
    apple: "/logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
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
      </body>
    </html>
  );
}
