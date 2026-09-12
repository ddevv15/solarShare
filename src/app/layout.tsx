import type { Metadata } from "next";

import { PublicConfigScript } from "@/adapters/next/public-config-script";
import { getPublicAppConfig } from "@/lib/config/web";

import "./globals.css";

export const metadata: Metadata = {
  title: "SolarShare",
  description: "A local solar credit marketplace for a seeded community.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const publicConfig = getPublicAppConfig();

  return (
    <html lang="en">
      <body>
        {children}
        <PublicConfigScript config={publicConfig} />
      </body>
    </html>
  );
}
