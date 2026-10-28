import { useState, useEffect, lazy, Suspense } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

// Load the chat surface only when the user opens it.
const ChatPanel = lazy(() => import("./ChatPanel").then((m) => ({ default: m.ChatPanel })));

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // Allow other components (e.g. HomePage hero button) to open the chat
  // via: window.dispatchEvent(new CustomEvent("aiclub:open-chat"))
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener("aiclub:open-chat", open);
    return () => window.removeEventListener("aiclub:open-chat", open);
  }, []);

  return (
    <>
      {/* Floating Toggle Button — always bottom-right (incl. mobile).
          Rendered OUTSIDE the centered dialog wrapper so it never sits
          mid-screen on top of content. */}
      {!isOpen && (
        <aside
          aria-label="Peths AI Club Assistant"
          className="fixed z-50 bottom-[clamp(1.25rem,4vw,2rem)] right-[clamp(1.25rem,4vw,2rem)]"
        >
          <Button
            variant="glass"
            onClick={() => setIsOpen(true)}
            className="ask-ai-fab rounded-full gap-2.5 hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer px-[clamp(1.25rem,3.5vw,1.75rem)]"
            aria-label="Open club AI chat assistant"
          >
            <MessageSquare className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF]" />
            <span className="text-fluid-small uppercase tracking-[0.05em] font-semibold">Ask AI</span>
          </Button>
        </aside>
      )}

      {isOpen && (
        <Suspense fallback={null}>
          <ChatPanel onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
