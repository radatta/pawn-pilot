"use client";

import React, { useRef, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react";

interface MoveChatDrawerProps {
  open: boolean;
  onClose: () => void;
  gameId: string | null;
  ply: number;
  context?: {
    fen_before: string;
    move_san: string;
    pv: string;
    eval_cp: number | null;
    mate_in: number | null;
    explanation?: string;
  };
}

export const MoveChatDrawer: React.FC<MoveChatDrawerProps> = ({
  open,
  onClose,
  gameId,
  ply,
  context,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: gameId ? `/api/games/${gameId}/moves/${ply}/chat` : "/api/chat",
    body: context ? { ...context } : undefined,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* drawer */}
      <div className="w-full max-w-md bg-card shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">Move {ply} Chat</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {/* messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          {messages.map((m, idx) => (
            <div
              key={m.id ?? idx}
              className={m.role === "user" ? "text-right" : "text-left"}
            >
              <span
                className={
                  m.role === "user"
                    ? "inline-block bg-primary text-primary-foreground rounded-lg px-3 py-2"
                    : "inline-block bg-muted text-foreground rounded-lg px-3 py-2"
                }
              >
                {m.content}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {/* input */}
        <form className="p-4 border-t flex gap-2" onSubmit={handleSubmit}>
          <input
            className="flex-1 border rounded-md px-3 py-2 bg-background text-foreground"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask the coach…"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
};
