import { useEffect, useState, createContext, useContext } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiclub-theme") as Theme;
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
    localStorage.setItem("aiclub-theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeBar({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme switcher"
      className={`inline-flex items-center p-0.5 sm:p-1 rounded-full border border-[#242021] bg-[#141213] text-[11px] sm:text-xs font-medium tracking-[0.06em] uppercase ${className}`}
    >
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all duration-200 ${
          theme === "dark"
            ? "bg-[#241416] text-[#FFFFFF] border border-[#5E2C32] shadow-sm"
            : "text-[#9B98A0] hover:text-[#E5E5E7] hover:bg-[#1E1A1B]"
        }`}
      >
        <Moon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${theme === "dark" ? "text-[#E0A3AA]" : "text-[#9B98A0]"}`} />
        <span>Dark</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all duration-200 ${
          theme === "light"
            ? "bg-[#FFFFFF] text-[#000000] border border-[#D4D4D8] shadow-sm font-semibold"
            : "text-[#9B98A0] hover:text-[#E5E5E7] hover:bg-[#1E1A1B]"
        }`}
      >
        <Sun className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${theme === "light" ? "text-[#000000]" : "text-[#9B98A0]"}`} />
        <span>Light</span>
      </button>
    </div>
  );
}
