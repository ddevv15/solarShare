"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function signInError(message: string): never {
  redirect(`/sign-in?error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData): Promise<void> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    signInError("Enter a valid seeded email and the demo password.");
  }

  const client = await createClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);

  if (error) {
    signInError("That seeded account could not be signed in.");
  }

  redirect("/");
}
