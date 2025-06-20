import Link from "next/link";
import { Crown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthErrorPage() {
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

        <Card className="bg-card/50 border-border backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-muted-foreground leading-relaxed">
              Something went wrong during the authentication process. Please try again or
              return to the homepage.
            </p>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/">Back to Homepage</Link>
              </Button>

              <Button variant="outline" asChild className="w-full">
                <Link href="/auth/login">Try Sign In Again</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
