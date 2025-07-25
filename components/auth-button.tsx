import Link from "next/link";
import { Button } from "./ui/button";
import { createSupabaseServer } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/signin">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/signup">Sign up</Link>
      </Button>
    </div>
  );
}
