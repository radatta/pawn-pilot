"use client";

import { Button } from "@/components/ui/button";
import { getGamesByUserId } from "@/lib/queries/get-games-by-userid";
import useSupabaseBrowser from "@/lib/supabase/client";
import Link from "next/link";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import toast from "react-hot-toast";

interface Game {
  id: string;
  created_at: string;
  result: string | null;
  status: string;
}

interface DashboardProps {
  userId: string;
}

export const Dashboard = ({ userId }: DashboardProps) => {
  const supabase = useSupabaseBrowser();

  const { data, error } = useQuery(getGamesByUserId(supabase, userId));

  if (error) {
    toast.error(error instanceof Error ? error.message : "An error occurred");
  }

  const games: Game[] = (data as Game[]) || [];

  return (
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
                <span>{new Date(game.created_at).toLocaleString()}</span>
                <span>{game.status}</span>
                <span>{game.result || "-"}</span>
                <div className="flex gap-5">
                  {game.status !== "completed" && (
                    <Button size="sm" asChild>
                      <Link href={`/play?gameId=${game.id}`}>Continue</Link>
                    </Button>
                  )}

                  {game.status === "completed" && (
                    <Button size="sm" asChild>
                      <Link href={`/analysis?gameId=${game.id}`}>Review</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              You have not played any games yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
