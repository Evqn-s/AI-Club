import { Link, useLocation } from "wouter";
import { ThemeBar } from "@/components/ThemeBar";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home" },
    { href: "/news", label: "News" },
    { href: "/calendar", label: "Calendar" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#242021] bg-[#0A090A]/95 backdrop-blur-none transition-colors">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 sm:px-6 py-2.5 sm:py-3 max-w-5xl">
        {/* Brand identity pill */}
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group">
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#241416] border border-[#5E2C32] text-xs font-mono font-bold text-[#E0A3AA]">
            AI
          </span>
          <span className="text-xs sm:text-sm font-display font-bold uppercase tracking-[0.08em] text-[#E5E5E7] group-hover:text-[#E0A3AA] transition-colors whitespace-nowrap">
            AI Club
          </span>
        </Link>

        {/* Dynamic Action Buttons Group: Shifts horizontally into any open space at top */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2.5 ml-auto">
          {/* Navigation Pills */}
          <nav className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-full border border-[#242021] bg-[#141213]">
            {links.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium uppercase tracking-[0.06em] transition-colors whitespace-nowrap ${
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
