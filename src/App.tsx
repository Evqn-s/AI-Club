import { useEffect, lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "@/components/ThemeToggle";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/ChatWidget";
import { OrganicBackground } from "@/components/OrganicBackground";
import { HomePage } from "@/pages/HomePage";
import { NewsPage } from "@/pages/NewsPage";
import { CalendarSkeleton } from "@/components/CalendarSkeleton";
import { prefetchRoute } from "@/lib/cache";

import { calendarComponentPromise } from "@/components/Navbar";

// Consumes the module promise pre-warmed on hover, or imports on demand
const CalendarPage = lazy(() => calendarComponentPromise || import("./pages/CalendarPage"));

export function App() {
  const [location] = useLocation();
  const isCalendar = location === "/calendar";

  useEffect(() => {
    // Warm up routes during idle time so navigation is instantaneous even on first click
    const timer = setTimeout(() => {
      prefetchRoute("/");
      prefetchRoute("/news");
      prefetchRoute("/calendar");
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] relative selection:bg-[#DC2626] selection:text-white transition-colors duration-200">
        {/* Structural Vector Geometry Background */}
        <OrganicBackground />

        <Navbar />

        <main
          className={`flex-1 flex flex-col items-stretch w-full mx-auto px-[var(--fluid-pad-x)] relative z-10 transition-all duration-300 ${
            isCalendar ? "max-w-[min(98vw,1440px)]" : "max-w-[var(--fluid-container-max)]"
          }`}
        >
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/news" component={NewsPage} />
            <Route path="/calendar">
              <Suspense fallback={<CalendarSkeleton />}>
                <CalendarPage />
              </Suspense>
            </Route>
            <Route>
              <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100dvh-5rem)] py-[clamp(3rem,10vw,6rem)] text-center">
                <h2 className="font-bold font-display text-fluid-h3 text-[#E5E5E7]">Page Not Found</h2>
                <p className="text-fluid-small uppercase tracking-[0.06em] text-[#67646C] mt-2">The requested route does not exist.</p>
              </div>
            </Route>
          </Switch>
        </main>

        {/* Persistent AI Assistant Widget */}
        <ChatWidget />
      </div>
    </ThemeProvider>
  );
}
export default App;
