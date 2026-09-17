"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NoAccess({ email }: { email: string }) {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="glass-strong card rise flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <ShieldAlert className="size-10 text-[var(--warn)]" />
        <h1 className="text-lg font-semibold">Waiting for an invite</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          <span className="font-medium text-[var(--fg)]">{email}</span> isn&apos;t part of the team
          yet. Ask your admin to invite this exact email, then sign in again.
        </p>
        <button
          className="btn btn-ghost mt-2"
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </main>
  );
}
