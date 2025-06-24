"use client";

import React, { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Move {ply} Chat</SheetTitle>
          <SheetDescription>Ask the coach about this move</SheetDescription>
        </SheetHeader>

        {/* messages */}
        <div className="flex-1 overflow-y-auto space-y-3 text-sm">
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
        <form className="border-t pt-4 flex gap-2" onSubmit={handleSubmit}>
          <Input
            className="flex-1"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask the coach…"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};
