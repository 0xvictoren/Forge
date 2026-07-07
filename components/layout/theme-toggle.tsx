"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        aria-pressed={theme === "light"}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        aria-pressed={theme === "dark"}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}