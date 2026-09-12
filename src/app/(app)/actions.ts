"use server";

import { redirect } from "next/navigation";

import type { SignOutActionState } from "@/app/(app)/_lib/sign-out-state";
import { createClient } from "@/lib/supabase/server";

export async function signOut(): Promise<SignOutActionState> {
  const client = await createClient();
  const { error } = await client.auth.signOut();

  if (error) {
    return {
      error:
        "SolarShare could not sign you out. Your session may still be active. Try again before leaving this browser.",
    };
  }

  redirect("/sign-in");
}
