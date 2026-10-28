import { Link, useLocation } from "wouter";
import { ThemeBar } from "@/components/ThemeBar";

// Module-level cache for the lazy component promise
export let calendarComponentPromise: Promise<typeof import("../pages/CalendarPage")> | null = null;

const isTouchDevice = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// Prefetch a route's data without pulling the Supabase client into the
// initial bundle — the dynamic import loads data.ts + client on demand.
function prefetchData(route: string) {
  if (isTouchDevice()) return;
  import("@/lib/data").then(({ prefetchRoute }) => prefetchRoute(route));
}

export const preloadCalendar = () => {
  if (isTouchDevice()) return;

  // 1. Fetch Supabase calendar data into lib/cache.ts memory cache
  prefetchData("/calendar");

  // 2. Force browser to download AND evaluate the CalendarPage bundle immediately
  if (!calendarComponentPromise) {
    calendarComponentPromise = import("../pages/CalendarPage");
  }
};

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home" },
    { href: "/news", label: "News" },
    { href: "/calendar", label: "Calendar" },
  ];

  return (
    <header className="relative z-40">
      <div className="mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-[var(--fluid-pad-x)] py-[clamp(0.5rem,2vw,0.75rem)] max-w-[var(--fluid-container-max)]">
        {/* Brand identity pill — order 1: top-left (incl. mobile) */}
        <Link
          href="/"
          onMouseEnter={() => prefetchData("/")}
          onFocus={() => prefetchData("/")}
          className="order-1 flex items-center gap-2 sm:gap-2.5 shrink-0 group"
        >
          <img
            src="/peths-ai-club-logo.png"
            alt="Peths AI Club logo"
            className="dark-brand-mark block h-[var(--fluid-icon-box)] w-[var(--fluid-icon-box)] rounded-full object-cover shadow-sm ring-1 ring-white/35"
          />
          <span className="text-fluid-body sm:text-fluid-small font-bold tracking-tight text-white group-hover:text-white/80 transition-colors whitespace-nowrap">
            Peths AI Club
          </span>
        </Link>

        {/* Theme Toggle — order 2 top-right on mobile, order 3 top-right on desktop */}
        <ThemeBar className="order-2 sm:order-3 shrink-0 ml-auto sm:ml-0" />

        {/* Navigation Pills — full-width centered row on mobile (below logo/theme),
            inline right-aligned group on desktop */}
        <nav className="site-nav-shell order-3 sm:order-2 flex items-center justify-center w-full sm:w-auto sm:justify-start p-[clamp(0.25rem,1vw,0.375rem)] sm:ml-auto gap-[clamp(0.25rem,1vw,0.375rem)] rounded-full glass-button">
          {links.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onMouseEnter={() => {
                  if (link.href === "/calendar") {
                    preloadCalendar();
                  } else {
                    prefetchData(link.href);
                  }
                }}
                onFocus={() => {
                  if (link.href === "/calendar") {
                    preloadCalendar();
                  } else {
                    prefetchData(link.href);
                  }
                }}
                className={`flex items-center justify-center rounded-full font-medium tracking-[0.05em] transition-all whitespace-nowrap px-[clamp(0.875rem,2.5vw,1.25rem)] py-[clamp(0.5rem,1.5vw,0.625rem)] min-h-[clamp(2.5rem,2.25rem_+_2vw,2.75rem)] text-fluid-body sm:px-[clamp(0.625rem,2vw,1rem)] sm:py-[clamp(0.25rem,1vw,0.375rem)] sm:min-h-0 sm:text-fluid-small cursor-pointer ${
                  isActive
                    ? "dark-active-nav bg-white/20 text-white border border-white/25 shadow-sm font-semibold"
                    : "text-[#8E8E93] hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
