import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Target,
  TrendingUp,
  Lightbulb,
  Puzzle,
  BookOpen,
  Crown,
  BarChart3,
  Zap,
  Play,
  Users,
  Award,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function PawnPilotLanding() {
  return (
    <div className="flex flex-col min-h-screen scrollbar-thin">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
            <Crown className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">PawnPilot</span>
        </Link>
        <nav className="ml-auto flex gap-6">
          <Link
            href="#features"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 lg:py-40">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 lg:grid-cols-[1fr_500px] lg:gap-16 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-8 animate-fade-in">
                <div className="space-y-6">
                  <Badge className="w-fit">
                    <Zap className="w-3 h-3 mr-1" />
                    AI-Powered Chess Coach
                  </Badge>
                  <h1 className="text-4xl font-bold tracking-tight sm:text-6xl xl:text-7xl">
                    Your Personal
                    <span className="block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      AI Chess Coach
                    </span>
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl leading-relaxed">
                    Accelerate your chess improvement with an adaptive AI that explains
                    every move, tracks your weaknesses, and creates personalized training
                    just for you.
                  </p>
                </div>
                <div className="flex flex-col gap-3 min-[400px]:flex-row">
                  <Button size="lg" className="font-semibold px-8 py-6 text-base">
                    <Play className="w-4 h-4 mr-2" />
                    Start Playing Now
                  </Button>
                  <Button variant="outline" size="lg" className="px-8 py-6 text-base">
                    Watch Demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <div className="flex items-center gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>10,000+ players</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    <span>+200 avg rating gain</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="w-96 h-96 bg-gradient-to-br from-card/50 to-muted/30 rounded-3xl flex items-center justify-center backdrop-blur-sm border">
                    <div className="w-80 h-80 bg-card/80 rounded-2xl flex items-center justify-center border">
                      <div className="grid grid-cols-8 gap-0 w-64 h-64 rounded-xl overflow-hidden border">
                        {Array.from({ length: 64 }, (_, i) => (
                          <div
                            key={i}
                            className={`aspect-square ${
                              (Math.floor(i / 8) + i) % 2 === 0
                                ? "bg-chess-100"
                                : "bg-chess-600"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 bg-card/90 backdrop-blur-sm rounded-2xl p-4 border">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div className="absolute -bottom-6 -left-6 bg-card/90 backdrop-blur-sm rounded-2xl p-4 border">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-32 bg-muted/30">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <Badge>Features</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl max-w-3xl">
                Everything You Need to Improve
              </h2>
              <p className="max-w-[800px] text-muted-foreground text-lg">
                Unlike traditional chess sites, PawnPilot focuses exclusively on your
                improvement with AI-powered insights and personalized training.
              </p>
            </div>
            <div className="grid max-w-6xl mx-auto gap-8 lg:grid-cols-3">
              <Card className="backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>Adaptive AI Opponent</CardTitle>
                  <CardDescription>
                    Play against a bot that dynamically adjusts its strength and style to
                    challenge you at just the right level.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>Real-Time Explanations</CardTitle>
                  <CardDescription>
                    Receive natural language feedback on your moves and the bot&apos;s
                    moves as you play, understanding the &quot;why&quot; behind every
                    decision.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>Weakness Tracking</CardTitle>
                  <CardDescription>
                    Automatic analysis of your games to identify recurring mistakes and
                    areas for improvement, visualized in your personal dashboard.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <Puzzle className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>Custom Puzzles</CardTitle>
                  <CardDescription>
                    Practice with puzzles generated from your own games and mistakes,
                    reinforcing concepts where you need it most.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>Opening Explorer</CardTitle>
                  <CardDescription>
                    Track your opening repertoire and get AI-driven suggestions for new
                    lines and improvements tailored to your play.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>Progress Analytics</CardTitle>
                  <CardDescription>
                    Visualize your improvement over time with detailed stats on accuracy,
                    blunder rates, and phase-by-phase strengths.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="w-full py-20 md:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <Badge>How It Works</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl max-w-3xl">
                Your Journey to Chess Mastery
              </h2>
              <p className="max-w-[800px] text-muted-foreground text-lg">
                PawnPilot guides you through a personalized learning experience designed
                to accelerate your improvement.
              </p>
            </div>
            <div className="grid max-w-5xl mx-auto gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl">
                  1
                </div>
                <h3 className="text-xl font-semibold">Play & Learn</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Start playing against our adaptive AI. Get real-time explanations for
                  every move and understand the reasoning behind each decision.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl">
                  2
                </div>
                <h3 className="text-xl font-semibold">Analyze & Improve</h3>
                <p className="text-muted-foreground leading-relaxed">
                  After each game, review your performance with detailed analysis.
                  Identify patterns in your play and areas for improvement.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl">
                  3
                </div>
                <h3 className="text-xl font-semibold">Practice & Master</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Train with personalized puzzles and exercises generated from your games.
                  Track your progress and watch your rating climb.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-32 bg-gradient-to-r from-muted to-card">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-8 text-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl max-w-3xl">
                  Ready to Elevate Your Chess Game?
                </h2>
                <p className="mx-auto max-w-[600px] text-muted-foreground text-lg">
                  Join thousands of players who are improving faster with AI-powered
                  coaching. Start your personalized chess journey today.
                </p>
              </div>
              <div className="flex flex-col gap-3 min-[400px]:flex-row">
                <Button size="lg" className="font-semibold px-8 py-6 text-base">
                  <Play className="w-4 h-4 mr-2" />
                  Start Playing Now
                </Button>
                <Button size="lg" variant="outline" className="px-8 py-6 text-base">
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-8 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
            <Crown className="h-3 w-3 text-primary-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            © 2025 PawnPilot. All rights reserved.
          </p>
        </div>
        <nav className="sm:ml-auto flex gap-6">
          <Link
            href="#"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="#"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="#"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  );
}
