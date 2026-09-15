import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

// Theme state is centralized here because CSS, the canvas background, and
// every route need to observe the same persisted choice.
interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  // Keep exactly one theme class active so CSS selectors never compete.
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
    // Persist after every state change and apply it again for non-click changes
    // such as restoring the saved preference during the first render.
    applyTheme(theme);
    localStorage.setItem("aiclub-theme", theme);
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    if (nextTheme === theme) return;

    // Apply before React re-renders so the visual switch feels instantaneous.
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
      className={`inline-flex h-[var(--fluid-icon-box)] w-[var(--fluid-icon-box)] items-center justify-center rounded-full border border-[#242021] bg-[#141213] text-[#E0A3AA] transition-colors hover:bg-[#241416] ${className}`}
    >
      <Icon className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" aria-hidden="true" />
    </button>
  );
}
