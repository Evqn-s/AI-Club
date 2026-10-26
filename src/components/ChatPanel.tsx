import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { X, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COOLDOWN_TICKS = 5;
const COOLDOWN_TICK_MS = 500;
const CHAR_INTERVAL_MS = 33;

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
        <span className="typing-cursor inline-block w-1.5 h-3 ml-0.5 bg-[#FF3B30] animate-pulse align-middle" />
      )}
    </>
  );
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [cooldown, setCooldown] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [hasPendingSubmit, setHasPendingSubmit] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedMessageIds = useRef<Set<string>>(new Set());
  const pendingSubmitRef = useRef(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
  });

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

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when cooldown expires
  useEffect(() => {
    if (cooldown === 0 && !isLoading && !isTyping) {
      inputRef.current?.focus();
      if (pendingSubmitRef.current && input.trim()) {
        pendingSubmitRef.current = false;
        setHasPendingSubmit(false);
        formRef.current?.requestSubmit();
      }
    }
  }, [cooldown, isLoading, isTyping, input]);

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
    startCooldown();
  }, []);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || pendingSubmitRef.current) return;
    if (cooldown > 0 || isLoading || isTyping) {
      pendingSubmitRef.current = true;
      setHasPendingSubmit(true);
      return;
    }
    setIsTyping(false);
    handleSubmit(e);
  }

  const isSubmitDisabled = !input.trim() || hasPendingSubmit;

  const cooldownSeconds = (cooldown * COOLDOWN_TICK_MS) / 1000;
  const cooldownDisplay = cooldownSeconds % 1 === 0 ? String(cooldownSeconds) : cooldownSeconds.toFixed(1);
  let placeholderText = "Ask about club details...";
  if (cooldown > 0) {
    placeholderText = `Wait ${cooldownDisplay}s before sending again…`;
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
        className="flex flex-col w-[var(--fluid-chat-w)] max-w-[calc(100vw-2rem)] h-[var(--fluid-chat-h)] max-h-[85vh] glass-panel backdrop-blur-xl rounded-[var(--fluid-radius-lg)] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[clamp(1rem,3vw,1.25rem)] py-[clamp(0.75rem,2.5vw,0.875rem)] bg-white/[0.04] border-b border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-[clamp(0.5rem,2vw,0.75rem)]">
            <div className="p-[clamp(0.25rem,1.5vw,0.375rem)] rounded-full glass-chip text-[#FF3B30]">
              <Bot className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" />
            </div>
            <div>
              <h2 className="text-fluid-small font-semibold tracking-[-0.01em] text-white">Club Assistant</h2>
              <p className="text-fluid-label uppercase tracking-[0.05em] text-[#8E8E93] font-medium">Knowledge Retrieval</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat window"
            className="p-[clamp(0.375rem,1.5vw,0.5rem)] rounded-full glass-chip text-[#8E8E93] hover:text-white min-h-[var(--fluid-control-h-sm)] min-w-[var(--fluid-control-h-sm)] flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <X className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-[var(--fluid-gap-sm)] space-y-[clamp(0.5rem,2vw,0.75rem)] bg-transparent">
          {messages.length === 0 && (
            <div className="text-center py-[clamp(2rem,8vw,3rem)] px-[var(--fluid-gap-sm)] text-[#8E8E93]">
              <p className="text-fluid-body font-semibold text-white">AI Club Knowledge Base</p>
              <p className="text-fluid-small mt-1 text-[#8E8E93]">Ask questions about our meetings, agenda, or guidelines.</p>
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
                  <div className="h-[clamp(1.25rem,4vw,1.5rem)] w-[clamp(1.25rem,4vw,1.5rem)] rounded-full glass-chip text-[#FF3B30] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-[clamp(0.625rem,2vw,0.75rem)] w-[clamp(0.625rem,2vw,0.75rem)]" />
                  </div>
                )}
                <div
                  className={`rounded-[var(--fluid-radius)] px-[clamp(0.75rem,2.5vw,1rem)] py-[clamp(0.5rem,2vw,0.625rem)] max-w-[82%] text-fluid-small leading-relaxed ${
                    isUser
                      ? "bg-[#FF3B30] text-white shadow-sm font-normal"
                      : "glass-cell text-white"
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
                  <div className="h-[clamp(1.25rem,4vw,1.5rem)] w-[clamp(1.25rem,4vw,1.5rem)] rounded-full glass-chip text-[#8E8E93] flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-[clamp(0.625rem,2vw,0.75rem)] w-[clamp(0.625rem,2vw,0.75rem)]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Processing indicator while waiting for response */}
          {isWaitingForFirstToken && (
            <div className="flex gap-[clamp(0.5rem,2vw,0.625rem)] justify-start">
              <div className="h-[clamp(1.25rem,4vw,1.5rem)] w-[clamp(1.25rem,4vw,1.5rem)] rounded-full glass-chip text-[#FF3B30] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-[clamp(0.625rem,2vw,0.75rem)] w-[clamp(0.625rem,2vw,0.75rem)]" />
              </div>
              <div className="rounded-[var(--fluid-radius)] px-[clamp(0.75rem,2.5vw,1rem)] py-[clamp(0.5rem,2vw,0.625rem)] glass-cell text-[#8E8E93] text-fluid-small flex items-center gap-1.5">
                <span className="thinking-dot inline-block h-[clamp(0.25rem,1vw,0.375rem)] w-[clamp(0.25rem,1vw,0.375rem)] rounded-full bg-[#FF3B30] animate-bounce"></span>
                <span className="thinking-dot inline-block h-[clamp(0.25rem,1vw,0.375rem)] w-[clamp(0.25rem,1vw,0.375rem)] rounded-full bg-[#FF3B30] animate-bounce [animation-delay:0.2s]"></span>
                <span className="thinking-dot inline-block h-[clamp(0.25rem,1vw,0.375rem)] w-[clamp(0.25rem,1vw,0.375rem)] rounded-full bg-[#FF3B30] animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-1 text-fluid-label uppercase tracking-[0.05em] font-medium">Processing</span>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="status-error rounded-[var(--fluid-radius)] border p-[var(--fluid-gap-sm)] text-fluid-small">
              Failed to receive answer. Please verify your connection or try again.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input with 5-second cooldown after typing completes */}
        <form ref={formRef} onSubmit={handleFormSubmit} className="p-[var(--fluid-gap-sm)] bg-white/[0.04] border-t border-white/10 backdrop-blur-md flex gap-[clamp(0.375rem,1.5vw,0.5rem)]">
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder={placeholderText}
            disabled={false}
            maxLength={1000}
            aria-label="Chat query input"
            className="glass-cell text-white placeholder:text-[#8E8E93]"
          />
          <Button
            type="submit"
            disabled={isSubmitDisabled}
            size="icon"
            aria-label={cooldown > 0 ? `Cooldown: ${cooldownDisplay}s remaining` : isTyping ? "AI is typing" : "Send message"}
            className="shrink-0 bg-[#FF3B30] hover:bg-[#D32F2F] text-white transition-all active:scale-95 cursor-pointer rounded-full"
          >
            {cooldown > 0 ? (
              <span className="text-fluid-label font-mono font-bold text-white">{cooldownDisplay}s</span>
            ) : (
              <Send className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-white" />
            )}
          </Button>
        </form>
      </div>
    </aside>
  );
}
