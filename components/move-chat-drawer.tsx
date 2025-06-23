"use client";

import React, { useRef, useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoveChat, ChatContext } from "@/lib/hooks/useMoveChat";

interface MoveChatDrawerProps {
  open: boolean;
  onClose: () => void;
  gameId: string | null;
  ply: number;
  context?: ChatContext;
}

export const MoveChatDrawer: React.FC<MoveChatDrawerProps> = ({
  open,
  onClose,
  gameId,
  ply,
  context,
}) => {
  const { messages, send } = useMoveChat(gameId, ply, context);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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
            <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
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
        <form
          className="p-4 border-t flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!input.trim()) return;
            const text = input;
            setInput("");
            await send(text);
          }}
        >
          <input
            className="flex-1 border rounded-md px-3 py-2 bg-background text-foreground"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the coach…"
          />
          <Button type="submit" disabled={!input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};
