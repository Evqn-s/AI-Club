import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { MessageSquare, X, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COOLDOWN_SECONDS = 5;
const TYPE_INTERVAL_MS = 333; // 3 characters per second (1 char every 333ms)

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedMessageIds = useRef<Set<string>>(new Set());

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
  });

  const lastMessage = messages[messages.length - 1];
  const isLatestAssistant = lastMessage?.role === "assistant";
  const latestAssistantId = isLatestAssistant ? lastMessage.id : null;
  const targetContent = isLatestAssistant ? lastMessage.content : "";

  // ── Typewriter effect: 3 characters per second, then start 5s cooldown ──
  useEffect(() => {
    if (!isLatestAssistant || !latestAssistantId) {
      setDisplayedChars(0);
      setIsTyping(false);
      return;
    }

    // Already completed typing this message previously
    if (completedMessageIds.current.has(latestAssistantId)) {
      setDisplayedChars(targetContent.length);
      setIsTyping(false);
      return;
    }

    // Still typing out characters
    if (displayedChars < targetContent.length) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        setDisplayedChars((prev) => prev + 1);
      }, TYPE_INTERVAL_MS);
      return () => clearTimeout(timer);
    }

    // Finished typing all characters AND stream is complete (!isLoading)
    if (displayedChars >= targetContent.length && targetContent.length > 0 && !isLoading) {
      setIsTyping(false);
      if (!completedMessageIds.current.has(latestAssistantId)) {
        completedMessageIds.current.add(latestAssistantId);
        // Start 5-second cooldown timer only after finishing the entire sentence
        startCooldown();
      }
    }
  }, [isLatestAssistant, latestAssistantId, targetContent, displayedChars, isLoading]);

  // Scroll on open, new messages, or typing advance
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages, displayedChars]);

  // Focus input when opened or when cooldown expires
  useEffect(() => {
    if (isOpen && cooldown === 0 && !isLoading && !isTyping) {
      inputRef.current?.focus();
    }
  }, [isOpen, cooldown, isLoading, isTyping]);

  // Escape key closes chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  function startCooldown() {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setCooldown(COOLDOWN_SECONDS);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current!);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cooldown > 0 || isLoading || isTyping || !input.trim()) return;
    setDisplayedChars(0);
    setIsTyping(false);
    handleSubmit(e);
    // Cooldown is NOT started here; it starts only after the entire sentence finishes typing
  }

  const isSendBlocked = isLoading || isTyping || cooldown > 0 || !input.trim();

  let placeholderText = "Ask about club details...";
  if (cooldown > 0) {
    placeholderText = `Wait ${cooldown}s before sending again…`;
  } else if (isTyping) {
    placeholderText = "Typing response…";
  } else if (isLoading) {
    placeholderText = "Processing…";
  }

  return (
    <aside aria-label="AI Club Assistant" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-12 px-6 gap-2.5 bg-[#241416] border border-[#5E2C32] text-[#FFFFFF] hover:bg-[#33181C] shadow-lg min-h-[48px]"
          aria-label="Open club AI chat assistant"
        >
          <MessageSquare className="h-4 w-4 text-[#E0A3AA]" />
          <span className="text-xs uppercase tracking-[0.08em] font-medium">Ask AI</span>
        </Button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Club AI Assistant Chat Window"
          className="flex flex-col w-[calc(100vw-2rem)] sm:w-[400px] max-w-sm h-[520px] max-h-[85vh] bg-[#0A090A] border border-[#242021] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#141213] border-b border-[#242021]">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA]">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold font-display uppercase tracking-[0.08em] text-[#E5E5E7]">Club Assistant</h2>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#67646C]">Knowledge Retrieval</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat window"
              className="p-2 rounded-full border border-[#242021] bg-[#0A090A] text-[#9B98A0] hover:text-[#E5E5E7] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#0A090A]">
            {messages.length === 0 && (
              <div className="text-center py-12 px-4 text-[#9B98A0]">
                <p className="font-display text-sm font-bold text-[#E5E5E7]">AI Club Knowledge Base</p>
                <p className="text-xs mt-1 text-[#67646C]">Ask questions about our meetings, agenda, or guidelines.</p>
              </div>
            )}

            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isThisLatestAssistant = !isUser && idx === messages.length - 1;
              const contentToDisplay =
                isThisLatestAssistant && !completedMessageIds.current.has(m.id)
                  ? m.content.slice(0, displayedChars)
                  : m.content;

              // Hide empty assistant bubble before first character is typed
              if (!isUser && isThisLatestAssistant && contentToDisplay.length === 0) {
                return null;
              }

              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-6 w-6 rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA] flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3 w-3" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 max-w-[82%] text-xs leading-relaxed ${
                      isUser
                        ? "bg-[#241416] text-[#FFFFFF] border border-[#5E2C32]"
                        : "bg-[#141213] text-[#E5E5E7] border border-[#242021]"
                    }`}
                  >
                    {contentToDisplay}
                    {isThisLatestAssistant && isTyping && (
                      <span className="inline-block w-1.5 h-3 ml-0.5 bg-[#E0A3AA] animate-pulse align-middle" />
                    )}
                  </div>
                  {isUser && (
                    <div className="h-6 w-6 rounded-full bg-[#1E1A1B] border border-[#382D30] text-[#9B98A0] flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show processing indicator only when waiting for the first character */}
            {isLoading && displayedChars === 0 && (
              <div className="flex gap-2.5 justify-start">
                <div className="h-6 w-6 rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 bg-[#141213] text-[#9B98A0] text-xs flex items-center gap-1.5 border border-[#242021]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E0A3AA] animate-bounce"></span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E0A3AA] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E0A3AA] animate-bounce [animation-delay:0.4s]"></span>
                  <span className="ml-1 text-[11px] uppercase tracking-[0.06em]">Processing</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-[#241416] border border-[#5E2C32] p-3 text-xs text-[#E0A3AA]">
                Failed to receive answer. Please verify your connection or try again.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input with 5-second cooldown after typing completes */}
          <form onSubmit={handleFormSubmit} className="p-3 bg-[#141213] border-t border-[#242021] flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder={placeholderText}
              disabled={isSendBlocked}
              maxLength={1000}
              aria-label="Chat query input"
              className="bg-[#0A090A] border-[#382D30] text-[#E5E5E7] text-xs h-11 px-4 placeholder:text-[#67646C]"
            />
            <Button
              type="submit"
              disabled={isSendBlocked}
              size="icon"
              aria-label={cooldown > 0 ? `Cooldown: ${cooldown}s remaining` : "Send message"}
              className="shrink-0 h-11 w-11 min-h-[44px] min-w-[44px] bg-[#241416] hover:bg-[#33181C] border border-[#5E2C32] text-[#E0A3AA] transition-all"
            >
              {cooldown > 0 ? (
                <span className="text-[11px] font-mono font-bold text-[#E0A3AA]">{cooldown}s</span>
              ) : (
                <Send className="h-4 w-4 text-[#E0A3AA]" />
              )}
            </Button>
          </form>
        </div>
      )}
    </aside>
  );
}
