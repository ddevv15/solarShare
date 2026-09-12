"use client";

import { Home, ShoppingBasket, SunMedium } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DashboardKind } from "@/application/viewer";
import { cn } from "@/lib/utils";

const navigationByDashboard = {
  operator: [{ href: "/", label: "Overview", Icon: Home }],
  seller: [
    { href: "/", label: "Overview", Icon: Home },
    { href: "/seller", label: "Seller forecast", Icon: SunMedium },
  ],
  buyer: [
    { href: "/", label: "Overview", Icon: Home },
    {
      href: "/marketplace",
      label: "Marketplace",
      Icon: ShoppingBasket,
    },
  ],
} as const;

export function AppNavigation({
  dashboardKind = "operator",
}: {
  dashboardKind?: DashboardKind;
}) {
  const pathname = usePathname();
  const items = navigationByDashboard[dashboardKind];

  return (
    <nav aria-label="Primary navigation">
      <ul className="flex gap-2 lg:flex-col">
        {items.map(({ href, Icon, label }) => {
          const isCurrent = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  isCurrent && "bg-accent text-accent-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
