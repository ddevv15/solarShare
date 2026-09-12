import "server-only";

import { cache } from "react";

import { resolveViewerState } from "@/application/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  createAssetRepository,
  createCommunityRepository,
  createProfileRepository,
} from "@/repositories/supabase/caller";

export const getCurrentViewerState = cache(async () => {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();

  const identity =
    error || !data.user ? null : { id: data.user.id, email: data.user.email };

  return resolveViewerState(identity, {
    profile: createProfileRepository(client),
    community: createCommunityRepository(client),
    asset: createAssetRepository(client),
  });
});
