import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/app/_lib/current-viewer";
import { AppShell } from "@/components/app-shell/app-shell";

import { signOut } from "./actions";

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getCurrentViewer();
  if (!viewer) redirect("/sign-in");

  return (
    <AppShell
      user={{
        displayName: viewer.profile.displayName,
        contextLabel: `${viewer.membership.marketAlias} · ${viewer.community.name}`,
      }}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
