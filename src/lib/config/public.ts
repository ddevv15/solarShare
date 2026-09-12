import { z } from "zod";

const publicAppConfigSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export type PublicAppConfig = z.infer<typeof publicAppConfigSchema>;

export const PUBLIC_CONFIG_ELEMENT_ID = "solarshare-public-config";

export function parsePublicAppConfig(value: unknown): PublicAppConfig {
  return publicAppConfigSchema.parse(value);
}
