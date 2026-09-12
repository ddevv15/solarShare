import "server-only";

import { ConfigurationError } from "@/lib/config/errors";
import type { PublicAppConfig } from "@/lib/config/public";
import { webEnvironmentSchema } from "@/lib/config/schema";

export type WebConfig = ReturnType<typeof parseWebConfig>;

let cachedWebConfig: WebConfig | undefined;

function parseWebConfig(environment: NodeJS.ProcessEnv) {
  const result = webEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new ConfigurationError("web", result.error);
  }

  return result.data;
}

export function getWebConfig(): WebConfig {
  cachedWebConfig ??= parseWebConfig(process.env);

  return cachedWebConfig;
}

export function validateWebConfigAtStartup(): void {
  getWebConfig();
}

export function getPublicAppConfig(): PublicAppConfig {
  const environment = getWebConfig();

  return {
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    timezone: environment.APP_TIMEZONE,
    currency: environment.APP_CURRENCY,
  };
}
