import { useEffect, useState, createContext, useContext } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

// ---------------------------------------------------------------------------
// Smooth, cascading theme transition
// ---------------------------------------------------------------------------
// Single set transition duration (ease-in-out) shared by every element, plus a
// tiny vertical stagger: elements near the top of the viewport start first and
// elements further down start later, so colours/elements "drift" together
// from the top of the page to the bottom on BOTH light↔dark directions.
// Fast by design: the whole effect completes well under 0.25s on most devices.
const THEME_TRANSITION_MS = 200; // per-element duration (ease-in-out, see index.css)
const THEME_MAX_STAGGER_MS = 40; // extra delay for elements at the bottom (total ≤ 240ms)
const THEME_CLEANUP_GRACE_MS = 100; // safety margin before disarming transitions

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

/// Run one animated theme switch:
/// 1. Add `theme-transition` to `<html>` — this arms the CSS transitions in
///    `src/index.css` (fixed 200ms ease-in-out duration).
/// 2. Give every element a `--theme-delay` that grows with its document-order
///    position. Elements are laid out roughly top→bottom in document order, so
///    this is a free proxy for vertical position (no expensive layout reads) —
///    the top-to-bottom cascade in BOTH directions.
/// 3. Force ONE synchronous style/layout pass while the colours are still the
///    OLD ones, so the browser has the transition armed AND knows the "before"
///    state. This happens in the same event as the button press — no waiting
///    for an animation frame.
/// 4. Flip the theme classes immediately; every element starts its fade from
///    its old colour right away (top elements first, bottom elements last).
/// 5. Disarm `.theme-transition` once every element has finished animating.
function applyThemeTransition(next: Theme): void {
  const root = document.documentElement;
  const token = ++transitionToken;

  // 1. Arm the CSS transitions.
  root.classList.add("theme-transition");

  // 2. Top-to-bottom cascade using document order as a vertical-position proxy.
  //    Sorted by construction (`querySelectorAll` returns document order), so
  //    delay grows smoothly from the top of the page to the bottom.
  if (!prefersReducedMotion()) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    const count = Math.max(elements.length, 1);
    for (let i = 0; i < elements.length; i++) {
      const progress = i / count; // 0 at the top → 1 at the bottom
      elements[i].style.setProperty("--theme-delay", `${(progress * THEME_MAX_STAGGER_MS).toFixed(1)}ms`);
    }
  }

  // 3. Force a synchronous reflow so the transition rule + old colours are
  //    committed for every element BEFORE we change the theme.
  void document.body.offsetHeight;

  // 4. Flip NOW — the switch response is instant; the fade itself then
  //    cascades from the top of the page to the bottom.
  applyThemeClasses(next);
  document.documentElement.dispatchEvent(new CustomEvent("theme-change"));

  // 5. Disarm once every element (incl. the longest stagger) has settled.
  setTimeout(() => {
    if (token === transitionToken) {
      root.classList.remove("theme-transition");
    }
  }, THEME_TRANSITION_MS + THEME_MAX_STAGGER_MS + THEME_CLEANUP_GRACE_MS);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aiclub-theme") as Theme;
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  // Apply the saved theme on first load — no animation, the page should simply
  // appear in its stored theme.
  useEffect(() => {
    applyThemeClasses(theme);
    localStorage.setItem("aiclub-theme", theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
