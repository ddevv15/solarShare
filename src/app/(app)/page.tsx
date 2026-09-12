import {
  ArrowRight,
  Building2,
  ShoppingBasket,
  Sparkles,
  SunMedium,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentViewerState } from "@/app/_lib/current-viewer";
import { PageHeader } from "@/components/foundation/page-header";
import { StatusLabel } from "@/components/foundation/status-label";
import { ViewerAccessFeedback } from "@/components/viewer-access-feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { signOut } from "@/app/(app)/actions";

const dashboardCopy = {
  seller: {
    eyebrow: "Seller dashboard",
    title: "Your rooftop energy, ready to share",
    description:
      "Review the seeded forecast first, then publish only the quantity and minimum price you are comfortable sharing.",
    action: "Review seller forecast",
    href: "/seller",
    icon: SunMedium,
  },
  buyer: {
    eyebrow: "Buyer dashboard",
    title: "Local solar offers in one clear market",
    description:
      "Choose an interval, review an estimate against the community tariff, and submit a reservation that stays pending until matching exists.",
    action: "Open the marketplace",
    href: "/marketplace",
    icon: ShoppingBasket,
  },
  operator: {
    eyebrow: "Operator dashboard",
    title: "A safe view of the seeded community",
    description:
      "Your operator membership grants community oversight while household readings and private ledger details remain redacted.",
    action: null,
    href: null,
    icon: Building2,
  },
} as const;

export default async function Home() {
  const viewerState = await getCurrentViewerState();
  if (viewerState.status === "anonymous") redirect("/sign-in");
  if (viewerState.status === "unresolved") {
    return (
      <ViewerAccessFeedback
        reason={viewerState.reason}
        signOutAction={signOut}
      />
    );
  }

  const { viewer } = viewerState;

  const copy = dashboardCopy[viewer.dashboardKind];
  const Icon = copy.icon;

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={`Welcome, ${viewer.profile.displayName}`}
        description={copy.description}
        action={
          copy.href ? (
            <Button asChild size="lg">
              <Link href={copy.href}>
                {copy.action}
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <section
        aria-labelledby="access-title"
        className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
      >
        <Card>
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-primary">
              <Icon aria-hidden="true" />
            </span>
            <CardTitle id="access-title">Your demo path</CardTitle>
            <CardDescription>{copy.title}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <StatusLabel tone="success">Active membership</StatusLabel>
              <StatusLabel>{viewer.membership.memberRole}</StatusLabel>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              Access is resolved from your active community membership. Seller
              capability is present only when the household owns an active solar
              asset.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-primary">
              <Sparkles aria-hidden="true" />
            </span>
            <CardTitle>Community context</CardTitle>
            <CardDescription>
              The trusted details carried by your caller bound session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Community</dt>
                <dd className="font-medium">{viewer.community.name}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Market alias</dt>
                <dd className="font-medium">{viewer.membership.marketAlias}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-medium">{viewer.community.timezone}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
