import { Link, useLocation } from "wouter";
import { ThemeBar } from "@/components/ThemeBar";
import { prefetchRoute } from "@/lib/cache";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home" },
    { href: "/news", label: "News" },
    { href: "/calendar", label: "Calendar" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#242021] bg-[#0A090A]/95 backdrop-blur-none transition-colors">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-[var(--fluid-pad-x)] py-[clamp(0.625rem,2vw,0.75rem)] max-w-[var(--fluid-container-max)]">
        {/* Brand identity pill */}
        <Link
          href="/"
          onMouseEnter={() => prefetchRoute("/")}
          onFocus={() => prefetchRoute("/")}
          onTouchStart={() => prefetchRoute("/")}
          className="flex items-center gap-2 sm:gap-2.5 shrink-0 group"
        >
          <span className="flex h-[var(--fluid-icon-box)] w-[var(--fluid-icon-box)] items-center justify-center rounded-full bg-[#241416] border border-[#5E2C32] text-fluid-small font-mono font-bold text-[#E0A3AA]">
            AI
          </span>
          <span className="text-fluid-small font-display font-bold uppercase tracking-[0.08em] text-[#E5E5E7] group-hover:text-[#E0A3AA] transition-colors whitespace-nowrap">
            AI Club
          </span>
        </Link>

        {/* Dynamic Action Buttons Group: Shifts horizontally into any open space at top */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2.5 ml-auto">
          {/* Navigation Pills */}
          <nav className="flex items-center gap-[clamp(0.125rem,1vw,0.25rem)] p-[clamp(0.125rem,1vw,0.25rem)] rounded-full border border-[#242021] bg-[#141213]">
            {links.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => prefetchRoute(link.href)}
                  onFocus={() => prefetchRoute(link.href)}
                  onTouchStart={() => prefetchRoute(link.href)}
                  className={`px-[clamp(0.625rem,2.5vw,1rem)] py-[clamp(0.25rem,1.5vw,0.375rem)] rounded-full text-fluid-label font-medium uppercase tracking-[0.06em] transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-[#241416] text-[#FFFFFF] border border-[#5E2C32] shadow-sm"
                      : "text-[#9B98A0] hover:text-[#E5E5E7] hover:bg-[#1E1A1B]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Theme Bar */}
          <ThemeBar className="shrink-0" />
        </div>
      </div>
    </header>
  );
}
