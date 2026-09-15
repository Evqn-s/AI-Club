import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COOLDOWN_TICKS = 5;
const COOLDOWN_TICK_MS = 500;
const CHAR_INTERVAL_MS = 33;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const chatEndpoint = import.meta.env.VITE_BACKEND_URL || "/api/chat";

function TypewriterMessage({
  content,
  alreadyCompleted,
  isLoading,
  onComplete,
  onProgress,
}: {
  content: string;
  alreadyCompleted: boolean;
  isLoading: boolean;
  onComplete: () => void;
  onProgress?: () => void;
}) {
  const [displayedCount, setDisplayedCount] = useState(alreadyCompleted ? content.length : 0);
  const completedRef = useRef(alreadyCompleted);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (alreadyCompleted) {
      completedRef.current = true;
      setDisplayedCount(content.length);
      return;
    }

    if (!content) return;

    if (displayedCount < content.length) {
      const timer = setTimeout(() => {
        setDisplayedCount((prev) => Math.min(prev + 1, content.length));
        onProgressRef.current?.();
      }, CHAR_INTERVAL_MS);

      return () => clearTimeout(timer);
    } else if (!isLoading && !completedRef.current && content.length > 0) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [content, displayedCount, alreadyCompleted, isLoading]);

  const displayedText = alreadyCompleted ? content : content.slice(0, displayedCount);
  const isTyping = !alreadyCompleted && !completedRef.current && displayedCount < content.length;

  return (
    <>
      {displayedText}
      {isTyping && (
        <span className="typing-cursor inline-block w-1.5 h-3 ml-0.5 bg-[#E0A3AA] animate-pulse align-middle" />
      )}
    </>
  );
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [cooldown, setCooldown] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedMessageIds = useRef<Set<string>>(new Set());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastMessage = messages[messages.length - 1];
  const isLatestAssistant = lastMessage?.role === "assistant";
  const latestAssistantId = isLatestAssistant ? lastMessage.id : null;
  const isLatestUnfinished = Boolean(
    isLatestAssistant && latestAssistantId && !completedMessageIds.current.has(latestAssistantId)
  );

  // Set typing state when an unfinished assistant message arrives
  useEffect(() => {
    if (isLatestUnfinished) {
      setIsTyping(true);
    }
  }, [isLatestUnfinished]);

  // If there's an error, ensure typing state is cleared so user isn't stuck
  useEffect(() => {
    if (error) {
      setIsTyping(false);
    }
  }, [error]);

  // (aiclub:open-chat is handled by the ChatWidget shell)

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when cooldown expires
  useEffect(() => {
    if (cooldown === 0 && !isLoading && !isTyping) {
      inputRef.current?.focus();
    }
  }, [cooldown, isLoading, isTyping]);

  // Escape key closes chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  function startCooldown() {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setCooldown(COOLDOWN_TICKS);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current!);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, COOLDOWN_TICK_MS);
  }

  const handleTypewriterComplete = useCallback((messageId: string) => {
    completedMessageIds.current.add(messageId);
    setIsTyping(false);
    setIsLoading(false);
    // Once all the text is displayed, start the 2.5-second cooldown
    startCooldown();
  }, []);

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cooldown > 0 || isLoading || isTyping || !input.trim()) return;

    const query = input.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };
    const history = messages.map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);
    setIsTyping(false);

    try {
      const response = await fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
      });
      const payload = (await response.json()) as { answer?: string; detail?: string; error?: string };
      if (!response.ok) throw new Error(payload.detail || payload.error || "The assistant could not respond.");

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.answer || "I don't have information about that.",
        },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not respond.");
      setIsLoading(false);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInput(event.target.value);
  }

  const isInputDisabled = isLoading || isTyping || cooldown > 0;
  const isSubmitDisabled = isInputDisabled || !input.trim();

  const cooldownSeconds = (cooldown * COOLDOWN_TICK_MS) / 1000;
  let placeholderText = "Ask about club details...";
  if (cooldown > 0) {
    placeholderText = `Wait ${cooldownSeconds % 1 === 0 ? cooldownSeconds : cooldownSeconds.toFixed(1)}s before sending again…`;
  } else if (isTyping) {
    placeholderText = "Typing response…";
  } else if (isLoading) {
    placeholderText = "Processing…";
  }

  const isWaitingForFirstToken =
    isLoading && (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.content);

  return (
      <aside
        aria-label="AI Club Assistant"
          className="fixed z-50 bottom-[clamp(1.25rem,4vw,2rem)] right-[clamp(1.25rem,4vw,2rem)] max-sm:bottom-[clamp(1.25rem,4vw,2rem)] max-sm:right-1/2 max-sm:translate-x-1/2"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Club AI Assistant Chat Window"
            className="flex flex-col w-[var(--fluid-chat-w)] max-w-[calc(100vw-2rem)] h-[var(--fluid-chat-h)] max-h-[85vh] bg-[#0A090A] border border-[#242021] rounded-[var(--fluid-radius-lg)] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
          {/* Header */}
          <div className="flex items-center justify-between px-[clamp(1rem,3vw,1.25rem)] py-[clamp(0.75rem,2.5vw,0.875rem)] bg-[#141213] border-b border-[#242021]">
            <div className="flex items-center gap-[clamp(0.5rem,2vw,0.75rem)]">
              <div className="p-[clamp(0.25rem,1.5vw,0.375rem)] rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA]">
                <Bot className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" />
              </div>
              <div>
                <h2 className="text-fluid-small font-bold font-display uppercase tracking-[0.08em] text-[#E5E5E7]">Club Assistant</h2>
                <p className="text-fluid-label uppercase tracking-[0.06em] text-[#67646C]">Knowledge Retrieval</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close chat window"
              className="p-[clamp(0.375rem,1.5vw,0.5rem)] rounded-full border border-[#242021] bg-[#0A090A] text-[#9B98A0] hover:text-[#E5E5E7] min-h-[var(--fluid-control-h-sm)] min-w-[var(--fluid-control-h-sm)] flex items-center justify-center transition-colors"
            >
              <X className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-[var(--fluid-gap-sm)] space-y-[clamp(0.5rem,2vw,0.75rem)] bg-[#0A090A]">
            {messages.length === 0 && (
              <div className="text-center py-[clamp(2rem,8vw,3rem)] px-[var(--fluid-gap-sm)] text-[#9B98A0]">
                <p className="font-display text-fluid-body font-bold text-[#E5E5E7]">AI Club Knowledge Base</p>
                <p className="text-fluid-small mt-1 text-[#67646C]">Ask questions about our meetings, agenda, or guidelines.</p>
              </div>
            )}

            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isLatest = idx === messages.length - 1;
              const isCompleted = completedMessageIds.current.has(m.id);

              return (
                <div
                  key={m.id}
                  className={`flex gap-[clamp(0.5rem,2vw,0.625rem)] ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-[clamp(1.25rem,4vw,1.5rem)] w-[clamp(1.25rem,4vw,1.5rem)] rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA] flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-[clamp(0.625rem,2vw,0.75rem)] w-[clamp(0.625rem,2vw,0.75rem)]" />
                    </div>
                  )}
                  <div
                    className={`rounded-[var(--fluid-radius)] px-[clamp(0.75rem,2.5vw,1rem)] py-[clamp(0.5rem,2vw,0.625rem)] max-w-[82%] text-fluid-small leading-relaxed ${
                      isUser
                        ? "bg-[#241416] text-[#FFFFFF] border border-[#5E2C32]"
                        : "bg-[#141213] text-[#E5E5E7] border border-[#242021]"
                    }`}
                  >
                    {isUser ? (
                      m.content
                    ) : (
                      <TypewriterMessage
                        content={m.content}
                        alreadyCompleted={isCompleted || !isLatest}
                        isLoading={isLoading && isLatest}
                        onComplete={() => handleTypewriterComplete(m.id)}
                        onProgress={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                      />
                    )}
                  </div>
                  {isUser && (
                    <div className="h-[clamp(1.25rem,4vw,1.5rem)] w-[clamp(1.25rem,4vw,1.5rem)] rounded-full bg-[#1E1A1B] border border-[#382D30] text-[#9B98A0] flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-[clamp(0.625rem,2vw,0.75rem)] w-[clamp(0.625rem,2vw,0.75rem)]" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Processing indicator while waiting for response */}
            {isWaitingForFirstToken && (
              <div className="flex gap-[clamp(0.5rem,2vw,0.625rem)] justify-start">
                <div className="h-[clamp(1.25rem,4vw,1.5rem)] w-[clamp(1.25rem,4vw,1.5rem)] rounded-full bg-[#241416] border border-[#5E2C32] text-[#E0A3AA] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-[clamp(0.625rem,2vw,0.75rem)] w-[clamp(0.625rem,2vw,0.75rem)]" />
                </div>
                <div className="rounded-[var(--fluid-radius)] px-[clamp(0.75rem,2.5vw,1rem)] py-[clamp(0.5rem,2vw,0.625rem)] bg-[#141213] text-[#9B98A0] text-fluid-small flex items-center gap-1.5 border border-[#242021]">
                  <span className="thinking-dot inline-block h-[clamp(0.25rem,1vw,0.375rem)] w-[clamp(0.25rem,1vw,0.375rem)] rounded-full bg-[#E0A3AA] animate-bounce"></span>
                  <span className="thinking-dot inline-block h-[clamp(0.25rem,1vw,0.375rem)] w-[clamp(0.25rem,1vw,0.375rem)] rounded-full bg-[#E0A3AA] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="thinking-dot inline-block h-[clamp(0.25rem,1vw,0.375rem)] w-[clamp(0.25rem,1vw,0.375rem)] rounded-full bg-[#E0A3AA] animate-bounce [animation-delay:0.4s]"></span>
                  <span className="ml-1 text-fluid-label uppercase tracking-[0.06em]">Processing</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-[var(--fluid-radius)] bg-[#241416] border border-[#5E2C32] p-[var(--fluid-gap-sm)] text-fluid-small text-[#E0A3AA]">
                Failed to receive answer. Please verify your connection or try again.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input with 5-second cooldown after typing completes */}
          <form onSubmit={handleFormSubmit} className="p-[var(--fluid-gap-sm)] bg-[#141213] border-t border-[#242021] flex gap-[clamp(0.375rem,1.5vw,0.5rem)]">
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder={placeholderText}
              disabled={isInputDisabled}
              maxLength={1000}
              aria-label="Chat query input"
              className="bg-[#0A090A] border-[#382D30] text-[#E5E5E7] placeholder:text-[#67646C]"
            />
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              size="icon"
              aria-label={cooldown > 0 ? `Cooldown: ${cooldown}s remaining` : isTyping ? "AI is typing" : "Send message"}
              className="shrink-0 bg-[#241416] hover:bg-[#33181C] border border-[#5E2C32] text-[#E0A3AA] transition-all"
            >
              {cooldown > 0 ? (
                <span className="text-fluid-label font-mono font-bold text-[#E0A3AA]">{cooldown}s</span>
              ) : (
                <Send className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA]" />
              )}
            </Button>
          </form>
        </div>
      </aside>
  );
}
