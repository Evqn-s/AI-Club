import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "@/components/ThemeToggle";
import { Navbar } from "@/components/Navbar";
import { HomePage } from "@/pages/HomePage";
import { CalendarSkeleton } from "@/components/CalendarSkeleton";

import { calendarComponentPromise } from "@/components/Navbar";

// The animated canvas background is purely decorative — keep it out of the
// initial bundle and mount it after first paint so it never competes with LCP.
const OrganicBackground = lazy(() =>
  import("@/components/OrganicBackground").then((m) => ({ default: m.OrganicBackground }))
);

// Consumes the module promise pre-warmed on hover, or imports on demand
const CalendarPage = lazy(() => calendarComponentPromise || import("./pages/CalendarPage"));

// Heavy, on-demand modules — split out of the initial bundle:
// - NewsPage pulls in framer-motion (shared with CalendarPage)
// - ChatWidget pulls in the AI SDK + zod streaming runtime
const NewsPage = lazy(() => import("./pages/NewsPage").then((m) => ({ default: m.NewsPage })));
const ChatWidget = lazy(() =>
  import("./components/ChatWidget").then((m) => ({ default: m.ChatWidget }))
);

export function App() {
  const [location] = useLocation();
  const isCalendar = location === "/calendar";

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] relative selection:bg-[#DC2626] selection:text-white transition-colors duration-200">
        {/* Decorative canvas — mounts after paint, never blocks LCP */}
        <Suspense fallback={null}>
          <OrganicBackground />
        </Suspense>

        <Navbar />

        <main
          className={`flex-1 flex flex-col items-stretch w-full mx-auto px-[var(--fluid-pad-x)] relative z-10 transition-all duration-300 ${
            isCalendar ? "max-w-[min(98vw,1440px)]" : "max-w-[var(--fluid-container-max)]"
          }`}
        >
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/news">
              <Suspense fallback={null}>
                <NewsPage />
              </Suspense>
            </Route>
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

        {/* Persistent AI Assistant Widget — lazy so the AI SDK + zod never
            block first paint; renders nothing until the chunk resolves */}
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      </div>
    </ThemeProvider>
  );
}
export default App;
