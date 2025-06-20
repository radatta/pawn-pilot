import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Game {
  id: string;
  created_at: string;
  result: string | null;
  status: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // This fetch call is made server-side, so it can securely use cookies
  // to call our own API, which in turn calls Supabase.
  const { data: games, error } = await supabase
    .from("games")
    .select("id, created_at, result, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
          <Link href="/" className="font-bold">
            PawnPilot
          </Link>
          <div className="flex items-center gap-4">
            <Button asChild>
              <Link href="/play">New Game</Link>
            </Button>
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="container">
          <h1 className="text-2xl font-bold mb-6">Your Games</h1>
          <div className="border rounded-lg">
            <div className="grid grid-cols-4 font-semibold border-b p-3">
              <div>Date</div>
              <div>Status</div>
              <div>Result</div>
              <div>Actions</div>
            </div>
            {games && games.length > 0 ? (
              games.map((game: Game) => (
                <div
                  key={game.id}
                  className="grid grid-cols-4 items-center p-3 border-b last:border-b-0"
                >
                  <span>{new Date(game.created_at).toLocaleDateString()}</span>
                  <span>{game.status}</span>
                  <span>{game.result || "-"}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/play?gameId=${game.id}`}>Review</Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                You have not played any games yet.
              </div>
            )}
            {error && (
              <div className="p-4 text-center text-destructive">
                Error loading games: {error.message}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
