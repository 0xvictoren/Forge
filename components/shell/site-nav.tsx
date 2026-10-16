"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { MAIN_NAV, isNavActive } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { ForgeWordmark } from "./forge-mark";
import { useAuthedNavigate } from "./use-authed-navigate";

export function SiteNav({ overHero = false }: { overHero?: boolean }) {
  const pathname = usePathname();
  const navigate = useAuthedNavigate();
  const { theme, toggleTheme } = useTheme();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  const onDark = overHero && !scrolled;

  const go = (href: string) => {
    setOpen(false);
    void navigate(href);
  };

  return (
    <>
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 sm:px-4"
        initial={false}
        animate={{ paddingTop: scrolled ? 10 : 16 }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
      >
        <LiquidGlass
          as="nav"
          radius={999}
          depth={16}
          scale={30}
          chroma={0.22}
          frost={scrolled ? 12 : 8}
          tone={onDark ? "dark" : "auto"}
          className={cn(
            "pointer-events-auto flex h-[54px] w-full max-w-[1080px] items-center gap-2 pl-4 pr-2 transition-colors duration-300",
            onDark && "text-white"
          )}
        >
          <ForgeWordmark onDark={onDark} />
          <div className="mx-auto hidden items-center gap-1 md:flex" aria-label="Main">
            {MAIN_NAV.map((item) => {
              const active = isNavActive(pathname, item);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.href)}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors",
                    active ? "" : onDark ? "text-white/75 hover:text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className={cn("absolute inset-0 rounded-full", onDark ? "bg-white/15" : "bg-[var(--bg-hover)]")}
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                onDark ? "hover:bg-white/15" : "hover:bg-[var(--bg-hover)]"
              )}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <ConnectWallet compact />
            <button
              type="button"
              className={cn("flex h-9 w-9 items-center justify-center rounded-full md:hidden", onDark ? "hover:bg-white/15" : "hover:bg-[var(--bg-hover)]")}
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </LiquidGlass>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="absolute inset-x-3 top-3"
              initial={{ y: -16, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: -12, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              <LiquidGlass radius={28} strong className="p-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <ForgeWordmark />
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--bg-hover)]">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-col">
                  {MAIN_NAV.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => go(item.href)}
                      className={cn(
                        "rounded-2xl px-4 py-3.5 text-left text-[17px] font-medium transition-colors hover:bg-[var(--bg-hover)]",
                        isNavActive(pathname, item) && "text-[var(--accent-ink)]"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </LiquidGlass>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function NavSpacer() {
  return <div aria-hidden className="h-[86px]" />;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[14px] font-medium text-[var(--accent-ink)] hover:underline underline-offset-4">
      <span aria-hidden>‹</span> {children}
    </Link>
  );
}
