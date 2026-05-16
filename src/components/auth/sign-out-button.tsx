"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { apiJson } from "@/lib/http";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await apiJson("/api/auth/sign-out", {
      method: "POST",
    });
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} className="icon-button" aria-label="Sign out">
      <LogOut className="h-4 w-4" />
    </button>
  );
}
