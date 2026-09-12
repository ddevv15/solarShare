import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentViewerState } from "@/app/_lib/current-viewer";
import { AppShell } from "@/components/app-shell/app-shell";
import { ViewerAccessFeedback } from "@/components/viewer-access-feedback";

import { signOut } from "./actions";

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewerState = await getCurrentViewerState();
  if (viewerState.status === "anonymous") redirect("/sign-in");

  if (viewerState.status === "unresolved") {
    return (
      <AppShell
        user={{
          displayName: viewerState.email || "Signed in account",
          contextLabel: "Community access unavailable",
        }}
        signOutAction={signOut}
      >
        <ViewerAccessFeedback
          reason={viewerState.reason}
          signOutAction={signOut}
        />
      </AppShell>
    );
  }

  const { viewer } = viewerState;

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
