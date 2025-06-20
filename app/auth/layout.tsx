import { Crown } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold">PawnPilot</span>
        </div>
        {children}
      </div>
    </div>
  );
}
