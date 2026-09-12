import "server-only";

import { createAdminClient } from "@supabase/server/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";
import { z } from "zod";

import { getWorkerConfig } from "@/lib/config/worker";

import type { OutboxCompletion, OutboxEvent, ResetDemoResult } from "../domain";
import { mapDatabaseError, RepositoryError, unwrap } from "../errors";
import type { TrustedOperationsRepository } from "../ports";
import type {
  CompleteOutboxInput,
  PostLedgerInput,
  ResetDemoInput,
} from "../schemas";
import {
  outboxEventSchema,
  resetDemoResultSchema,
  timestampSchema,
  uuidSchema,
} from "../schemas";

/**
 * Trusted operations. These are the only four functions a secret client may
 * call: the migration revokes `service_role` from every table, so this adapter
 * has no generic privileged query surface. It must never be reached from a
 * route or page - only from a worker or a server action that owns the check.
 */

const completionSchema = z.object({
  eventId: uuidSchema,
  communityId: uuidSchema,
  status: z.string(),
  attemptCount: z.string().regex(/^\d+$/),
  availableAt: timestampSchema,
  deliveredAt: timestampSchema.nullable(),
});

function createSecretClient(): SupabaseClient<Database> {
  const config = getWorkerConfig();
  if (!config.SUPABASE_URL || !config.SUPABASE_SECRET_KEY) {
    throw new RepositoryError(
      "unavailable",
      "Trusted operations need SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return createAdminClient({
    env: {
      url: config.SUPABASE_URL,
      secretKeys: { default: config.SUPABASE_SECRET_KEY },
    },
  });
}

export function createTrustedOperationsRepository(
  client: SupabaseClient<Database> = createSecretClient(),
): TrustedOperationsRepository {
  return {
    async claimOutbox(
      workerId: string,
      limit: number,
      claimTtlSeconds: number,
    ): Promise<OutboxEvent[]> {
      const result = await client.rpc("claim_outbox_events", {
        p_worker_id: workerId,
        p_limit: limit,
        p_claim_ttl_seconds: claimTtlSeconds,
      });
      if (result.error) throw mapDatabaseError(result.error);
      const claimed = Array.isArray(result.data) ? result.data : [];
      return claimed.map((row) => outboxEventSchema.parse(row) as OutboxEvent);
    },

    async completeOutbox(
      input: CompleteOutboxInput,
    ): Promise<OutboxCompletion> {
      const result = await client.rpc("complete_outbox_event", {
        p_event_id: input.eventId,
        p_claim_token: input.claimToken,
        p_delivered: input.delivered,
        p_error_code: input.errorCode ?? undefined,
      });
      return completionSchema.parse(unwrap(result));
    },

    async postLedger(input: PostLedgerInput): Promise<string | null> {
      const result = await client.rpc("post_ledger_transaction", {
        p_community_id: input.communityId,
        p_settlement_id: input.settlementId,
        p_buyer_account_id: input.buyerAccountId,
        p_seller_account_id: input.sellerAccountId,
        p_idempotency_key: input.idempotencyKey,
      });
      if (result.error) throw mapDatabaseError(result.error);
      // A zero credit settlement posts no ledger rows and returns null.
      return result.data === null ? null : uuidSchema.parse(result.data);
    },

    async resetDemo(input: ResetDemoInput): Promise<ResetDemoResult> {
      const result = await client.rpc("reset_demo_community", {
        p_community_id: input.communityId,
        p_actor_user_id: input.actorUserId,
        p_idempotency_key: input.idempotencyKey,
        p_anchor_date: input.anchorDate ?? undefined,
      });
      return resetDemoResultSchema.parse(unwrap(result));
    },
  };
}
