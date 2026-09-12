import { createBrowserClient } from "@supabase/ssr";

import { getBrowserPublicConfig } from "@/lib/config/browser";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const config = getBrowserPublicConfig();

  browserClient = createBrowserClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
  );

  return browserClient;
}
