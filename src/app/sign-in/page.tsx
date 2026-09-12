import { LockKeyhole, Sun, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { signOut } from "@/app/(app)/actions";
import { getCurrentViewerState } from "@/app/_lib/current-viewer";
import { ViewerAccessFeedback } from "@/components/viewer-access-feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { signIn } from "./actions";

type SignInPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const viewerState = await getCurrentViewerState();
  if (viewerState.status === "resolved") redirect("/");

  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:grid lg:place-items-center lg:py-12">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,0.7fr)]">
        <section className="flex flex-col justify-between gap-12 bg-primary p-8 text-primary-foreground sm:p-10 lg:p-12">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3 text-lg font-semibold">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary-foreground text-primary">
                <Sun aria-hidden="true" />
              </span>
              SolarShare
            </div>
            <div className="flex max-w-xl flex-col gap-4">
              <p className="text-sm font-semibold uppercase tracking-wider">
                Seeded community access
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                One community, three clear demo paths
              </h1>
              <p className="text-base leading-relaxed text-primary-foreground/90 sm:text-lg">
                Sign in as a seller, buyer, or operator. SolarShare resolves
                access from the active community membership and keeps every
                household boundary in place.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="flex gap-3 rounded-xl bg-primary-foreground/10 p-4">
              <Users aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm leading-relaxed">
                Seller and buyer accounts receive household access only.
              </p>
            </div>
            <div className="flex gap-3 rounded-xl bg-primary-foreground/10 p-4">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
              />
              <p className="text-sm leading-relaxed">
                Private records stay protected by caller bound Row Level
                Security.
              </p>
            </div>
          </div>
        </section>

        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="px-6 pt-8 sm:px-10 sm:pt-10">
            <CardTitle className="text-2xl">
              {viewerState.status === "unresolved"
                ? "Resolve this session"
                : "Enter the demo"}
            </CardTitle>
            <CardDescription>
              {viewerState.status === "unresolved"
                ? "You are signed in, but this account cannot enter the community."
                : "Use any seeded email with `SOLARSHARE_DEMO_PASSWORD` from your local environment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-10">
            {viewerState.status === "unresolved" ? (
              <ViewerAccessFeedback
                reason={viewerState.reason}
                signOutAction={signOut}
              />
            ) : (
              <form action={signIn} className="flex flex-col gap-6">
                {error ? (
                  <Alert variant="destructive" role="alert">
                    <LockKeyhole aria-hidden="true" />
                    <AlertTitle>Sign in failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Seeded email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="seller@solarshare.local"
                      required
                    />
                    <FieldDescription>
                      Try seller@solarshare.local, buyer1@solarshare.local, or
                      operator@solarshare.local.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Demo password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                </FieldGroup>
                <Button type="submit" size="lg" className="w-full">
                  Sign in to SolarShare
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="px-6 pb-8 text-sm text-muted-foreground sm:px-10 sm:pb-10">
            {viewerState.status === "unresolved"
              ? "Sign out before trying another seeded account."
              : "Public registration is intentionally outside this first release."}
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
