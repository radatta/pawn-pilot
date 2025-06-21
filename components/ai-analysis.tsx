"use client";

import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AIAnalysisProps {
  analysis: string;
  isThinking?: boolean;
}

export function AIAnalysis({ analysis, isThinking = false }: AIAnalysisProps) {
  return (
    <Card className="bg-card/50 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          PawnPilot&apos;s Insight
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isThinking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-100" />
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-200" />
            </div>
            Analyzing position...
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {analysis}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
