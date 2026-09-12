import "server-only";

import { cache } from "react";

import { resolveViewerContext } from "@/application/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  createAssetRepository,
  createCommunityRepository,
  createProfileRepository,
} from "@/repositories/supabase/caller";

export const getCurrentViewer = cache(async () => {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) return null;

  return resolveViewerContext(
    { id: data.user.id, email: data.user.email },
    {
      profile: createProfileRepository(client),
      community: createCommunityRepository(client),
      asset: createAssetRepository(client),
    },
  );
});
