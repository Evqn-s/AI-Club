import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiclub-theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("aiclub-theme", theme);
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    if (nextTheme === theme) return;

    applyTheme(nextTheme);
    setThemeState(nextTheme);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className={`inline-flex h-[var(--fluid-icon-box)] w-[var(--fluid-icon-box)] items-center justify-center rounded-full glass glass-panel text-[#E0A3AA] transition-colors hover:brightness-125 ${className}`}
    >
      <Icon className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" aria-hidden="true" />
    </button>
  );
}
