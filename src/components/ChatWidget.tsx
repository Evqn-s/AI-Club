import { useState, useEffect, lazy, Suspense } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

// The heavy AI SDK runtime (useChat + zod streaming) loads only when the user
// actually opens the chat — the floating button stays instant and tiny.
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
          aria-label="AI Club Assistant"
          className="fixed z-50 bottom-[clamp(1.25rem,4vw,2rem)] right-[clamp(1.25rem,4vw,2rem)]"
        >
          <Button
            variant="glass"
            onClick={() => setIsOpen(true)}
            className="ask-ai-fab rounded-full gap-2.5 shadow-2xl hover:scale-[1.03] active:scale-[0.97]"
            aria-label="Open club AI chat assistant"
          >
            <MessageSquare className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA]" />
            <span className="text-fluid-small uppercase tracking-[0.08em] font-medium">Ask AI</span>
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
