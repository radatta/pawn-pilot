"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";

interface MoveChatButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const MoveChatButton: React.FC<MoveChatButtonProps> = ({
  onClick,
  disabled = false,
}) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground"
    >
      <MessageCircle className="w-4 h-4" />
    </Button>
  );
};
