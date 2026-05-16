"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} className="icon-button" aria-label="Sign out">
      <LogOut className="h-4 w-4" />
    </button>
  );
}

