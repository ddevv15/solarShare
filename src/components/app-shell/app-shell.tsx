import { Sun } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { SignOutAction } from "@/app/(app)/_lib/sign-out-state";
import type { DashboardKind } from "@/application/viewer";
import { AppNavigation } from "@/components/app-shell/app-navigation";
import { SignOutForm } from "@/components/app-shell/sign-out-form";
import { StatusLabel } from "@/components/foundation/status-label";

type AppShellProps = {
  children: ReactNode;
  dashboardKind?: DashboardKind;
  user?: {
    displayName: string;
    contextLabel: string;
  };
  signOutAction?: SignOutAction;
};

function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-3 rounded-md font-semibold text-foreground"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sun aria-hidden="true" className="size-5" />
      </span>
      <span>SolarShare</span>
    </Link>
  );
}

export function AppShell({
  children,
  dashboardKind,
  user,
  signOutAction,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed start-4 top-4 -translate-y-24 rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="border-b bg-card px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <div className="flex items-center justify-between gap-3">
            <AppNavigation dashboardKind={dashboardKind} />
            {signOutAction ? (
              <SignOutForm action={signOutAction} presentation="icon" />
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-screen max-w-screen-2xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden border-e bg-card lg:flex lg:flex-col lg:justify-between lg:p-6">
          <div className="flex flex-col gap-8">
            <Brand />
            <AppNavigation dashboardKind={dashboardKind} />
          </div>
          <div className="flex flex-col gap-4 border-t pt-5">
            {user ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{user.displayName}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {user.contextLabel}
                </p>
              </div>
            ) : (
              <StatusLabel tone="success">Foundation ready</StatusLabel>
            )}
            {signOutAction ? (
              <SignOutForm action={signOutAction} presentation="navigation" />
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 p-4 sm:p-6 lg:p-10"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
              {children}
            </div>
          </main>
          <footer className="border-t px-4 py-5 text-center text-sm text-muted-foreground sm:px-6 lg:px-10">
            SolarShare community energy demo
          </footer>
        </div>
      </div>
    </div>
  );
}
