import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpSuccessPage() {
  return (
    <div>
      <Card className="bg-card/50 border-border backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground leading-relaxed">
            We&apos;ve sent a confirmation link to your email address. Please click the
            link to complete your registration and start your chess journey.
          </p>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/auth/signin">Continue to Sign In</Link>
            </Button>

            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the email?{" "}
              <Button variant="link" size="sm" className="h-auto p-0">
                Resend confirmation
              </Button>
            </p>
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
  );
}
