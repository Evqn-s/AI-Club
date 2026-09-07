import { Route, Switch } from "wouter";
import { ThemeProvider } from "@/components/ThemeBar";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/ChatWidget";
import { OrganicBackground } from "@/components/OrganicBackground";
import { HomePage } from "@/pages/HomePage";
import { NewsPage } from "@/pages/NewsPage";
import { CalendarPage } from "@/pages/CalendarPage";

export function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-[#0A090A] text-[#E5E5E7] relative selection:bg-[#DC2626] selection:text-white transition-colors duration-200">
        {/* Structural Vector Geometry Background */}
        <OrganicBackground />

        <Navbar />

        <main className="flex-1 mx-auto w-full max-w-5xl px-6 sm:px-8 relative z-10">
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/news" component={NewsPage} />
            <Route path="/calendar" component={CalendarPage} />
            <Route>
              <div className="py-24 text-center">
                <h2 className="text-2xl font-bold font-display text-[#E5E5E7]">Page Not Found</h2>
                <p className="text-sm uppercase tracking-[0.06em] text-[#67646C] mt-2">The requested route does not exist.</p>
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
