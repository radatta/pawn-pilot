import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getGamesByUserId } from "@/lib/queries/get-games-by-userid";
import { Dashboard } from "./Dashboard";
import { dehydrate, Hydrate, QueryClient } from "@tanstack/react-query";
import { prefetchQuery } from "@supabase-cache-helpers/postgrest-react-query";

export default async function DashboardPage() {
  const queryClient = new QueryClient();
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user!.id;

  await prefetchQuery(queryClient, getGamesByUserId(supabase, userId));

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
      <Hydrate state={dehydrate(queryClient)}>
        <Dashboard userId={userId} />
      </Hydrate>
    </div>
  );
}
