import { useEffect, useState, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

// ---------------------------------------------------------------------------
// Smooth, cascading theme transition
// ---------------------------------------------------------------------------
// DESIGN RULE: theme toggles must do ZERO per-element work. The DOM order of
// the page never changes between dark/light switches — only colours do — so
// the top→bottom `--theme-delay` values are baked onto every element ONCE at
// startup (off the critical path). A toggle then just arms the CSS transition
// and flips the theme class in the same frame: instant start, no lag.
//
// Cascade order comes from document order (header/menu first, then the title,
// then stacked/repeated elements), so the fade always begins at the TOP.
// Fast by design: the whole effect completes well under 0.25s on most devices.
const THEME_TRANSITION_MS = 200; // per-element duration (ease-in-out, see index.css)
const THEME_MAX_STAGGER_MS = 90; // total top→bottom cascade spread (document order)
const THEME_CLEANUP_GRACE_MS = 80; // safety margin before disarming transitions

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

/// Apply the `.dark` / `.light` classes on `<html>` for the given theme.
function applyThemeClasses(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
    root.classList.remove("light");
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Guards overlapping toggles: only the most recent transition may arm/disarm.
let transitionToken = 0;

/// Pre-compute the top→bottom cascade. `--theme-delay` is set on every element
/// in document order (querySelectorAll returns the DOM in that order), so delay
/// grows monotonically from the page's first element (titlebar/menu) down
/// through the title and stacked content blocks. Delays never change between
/// theme toggles, so we only re-run this after navigation (when React mounts
/// new page content) — a toggle itself never touches the DOM, so the switch
/// starts instantly even on slow phones.
function bakeThemeCascade(): void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  const count = Math.max(elements.length, 1);
  for (let i = 0; i < elements.length; i++) {
    const progress = i / count; // 0 at the top → 1 at the bottom
    elements[i].style.setProperty("--theme-delay", `${(progress * THEME_MAX_STAGGER_MS).toFixed(1)}ms`);
  }
}

/// Run one animated theme switch — deliberately tiny, with no per-element work:
/// 1. Add `theme-transition` to `<html>` — this arms the CSS transitions in
///    `src/index.css` (fixed 200ms ease-in-out duration + the pre-baked delay).
/// 2. Force a single synchronous reflow so the browser commits the OLD colours
///    with the transition armed, guaranteeing the fades fire.
/// 3. Flip the theme classes IMMEDIATELY — the top of the page starts changing
///    within the same event handler as the button press.
/// 4. Disarm `.theme-transition` once every element has finished animating.
function applyThemeTransition(next: Theme): void {
  const root = document.documentElement;
  const token = ++transitionToken;

  // 1. Arm the CSS transitions (delays were baked at startup).
  root.classList.add("theme-transition");

  // 2. Force one cheap synchronous reflow while colours are still OLD, so the
  //    browser knows the starting point of every transition.
  void document.body.offsetHeight;

  // 3. Flip NOW — instant response; elements then fade top-to-bottom.
  applyThemeClasses(next);
  document.documentElement.dispatchEvent(new CustomEvent("theme-change"));

  // 4. Disarm once every element (incl. the longest cascade delay) has settled.
  setTimeout(() => {
    if (token === transitionToken) {
      root.classList.remove("theme-transition");
    }
  }, THEME_TRANSITION_MS + THEME_MAX_STAGGER_MS + THEME_CLEANUP_GRACE_MS);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pathname] = useLocation();

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiclub-theme") as Theme;
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  // Apply the saved theme on first load — no animation, the page should simply
  // appear in its stored theme. Then bake the top→bottom cascade delays NOW so
  // the very first toggle is already instant.
  useEffect(() => {
    applyThemeClasses(theme);
    localStorage.setItem("aiclub-theme", theme);
    bakeThemeCascade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the route changes (App.tsx swaps the page, remounting fresh DOM), the
  // new elements have no delays yet — re-bake so the cascade stays intact for
  // every page. This is a style-only pass, kept off the instant toggle path.
  useEffect(() => {
    if (!prefersReducedMotion()) bakeThemeCascade();
  }, [pathname]);

  const setTheme = (next: Theme) => {
    if (next === theme) return;
    setThemeState(next);
    localStorage.setItem("aiclub-theme", next);
    applyThemeTransition(next);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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
