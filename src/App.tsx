import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { ThemeProvider } from "@/components/ThemeToggle";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/ChatWidget";
import { OrganicBackground } from "@/components/OrganicBackground";
import { HomePage } from "@/pages/HomePage";
import { NewsPage } from "@/pages/NewsPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { prefetchRoute } from "@/lib/cache";

export function App() {
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
      <div className="min-h-screen flex flex-col bg-[#0A090A] text-[#E5E5E7] relative selection:bg-[#DC2626] selection:text-white transition-colors duration-200">
        {/* Structural Vector Geometry Background */}
        <OrganicBackground />

        <Navbar />

        <main className="flex-1 flex flex-col items-stretch w-full max-w-[var(--fluid-container-max)] mx-auto px-[var(--fluid-pad-x)] relative z-10">
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/news" component={NewsPage} />
            <Route path="/calendar" component={CalendarPage} />
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
