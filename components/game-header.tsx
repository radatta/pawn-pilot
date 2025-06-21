import Link from "next/link";
import { Button } from "./ui/button";
import { ArrowLeft, Crown } from "lucide-react";

interface Props {
  backHref: string;
  title?: string;
}

export function GameHeader({ backHref, title = "PawnPilot" }: Props) {
  return (
    <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
            <Crown className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">{title}</span>
        </div>
      </div>
    </header>
  );
}
