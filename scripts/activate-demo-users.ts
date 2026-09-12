import { createAdminClient } from "@supabase/server/core";
import { z } from "zod";

// No generated Database type here on purpose: this script only calls the Auth
// admin API, which is schema independent, so it must stay runnable before the
// first `pnpm db:types` against a live database.

const configurationSchema = z.object({
  APP_ENV: z.enum(["local", "test"]),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
  SOLARSHARE_DEMO_PASSWORD: z.string().min(8),
});

const userIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
  "20000000-0000-4000-8000-000000000004",
  "20000000-0000-4000-8000-000000000005",
  "20000000-0000-4000-8000-000000000006",
] as const;

async function activateDemoUsers() {
  const configuration = configurationSchema.parse(process.env);
  const client = createAdminClient({
    env: {
      url: configuration.SUPABASE_URL,
      secretKeys: { default: configuration.SUPABASE_SECRET_KEY },
    },
  });

  for (const userId of userIds) {
    const { error } = await client.auth.admin.updateUserById(userId, {
      password: configuration.SOLARSHARE_DEMO_PASSWORD,
    });

    if (error) {
      throw new Error(
        `Could not activate demo user ${userId}: ${error.message}`,
      );
    }
  }
}

// Invoked rather than awaited at the top level: package.json has no
// "type": "module", so tsx compiles this to CJS, where top-level await is a
// syntax error and the script cannot run at all.
activateDemoUsers().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
