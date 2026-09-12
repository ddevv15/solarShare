import { describe, expect, it, vi } from "vitest";

import { resolveViewerState } from "@/application/viewer";
import type {
  Community,
  CommunityMembership,
  EnergyAsset,
  Profile,
} from "@/repositories/domain";
import type {
  AssetRepository,
  CommunityRepository,
  ProfileRepository,
} from "@/repositories/ports";

const timestamp = "2026-09-12T00:00:00.000Z";

const profile: Profile = {
  id: "user-1",
  displayName: "Asha Solar Home",
  latitudeApprox: null,
  longitudeApprox: null,
  timezone: "Asia/Kolkata",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const community: Community = {
  id: "community-1",
  name: "Sunrise Community",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "active",
};

const activeMembership: CommunityMembership = {
  communityId: community.id,
  userId: profile.id,
  memberRole: "household",
  status: "active",
  marketAlias: "Sun Home",
  joinedAt: timestamp,
  updatedAt: timestamp,
};

const solarAsset: EnergyAsset = {
  id: "asset-1",
  communityId: community.id,
  assetType: "solar",
  name: "Rooftop array",
  capacityKw: "4.5",
  tiltDegrees: null,
  azimuthDegrees: null,
  reserveKwh: "0",
  status: "active",
  version: "1",
  createdAt: timestamp,
  updatedAt: timestamp,
};

function makeRepositories(
  memberships: CommunityMembership[],
  overrides: {
    profile?: Profile | null;
    community?: Community | null;
  } = {},
) {
  const resolvedProfile: Profile | null =
    "profile" in overrides ? (overrides.profile ?? null) : profile;
  const resolvedCommunity: Community | null =
    "community" in overrides ? (overrides.community ?? null) : community;

  const profileRepository = {
    getOwnProfile: vi.fn(async () => resolvedProfile),
    updateOwnProfile: vi.fn(async () => profile),
  } satisfies ProfileRepository;

  const communityRepository = {
    listOwnMemberships: vi.fn(async () => memberships),
    getCommunity: vi.fn(async () => resolvedCommunity),
    listMarketplace: vi.fn(async () => ({ items: [] })),
    listMapFeatures: vi.fn(async () => ({ items: [] })),
    listOperatorMembers: vi.fn(async () => ({ items: [] })),
  } satisfies CommunityRepository;

  const assetRepository = {
    listOwned: vi.fn(async () => ({ items: [solarAsset] })),
    getOwned: vi.fn(async () => solarAsset),
    create: vi.fn(async () => solarAsset),
    update: vi.fn(async () => solarAsset),
  } satisfies AssetRepository;

  return {
    repositories: {
      profile: profileRepository,
      community: communityRepository,
      asset: assetRepository,
    },
    profileRepository,
    communityRepository,
    assetRepository,
  };
}

describe("resolveViewerState", () => {
  it("keeps a missing session distinct from an unresolved session", async () => {
    const { repositories, communityRepository } = makeRepositories([]);

    const result = await resolveViewerState(null, repositories);

    expect(result).toEqual({ status: "anonymous" });
    expect(communityRepository.listOwnMemberships).not.toHaveBeenCalled();
  });

  it("resolves a session with exactly one active membership", async () => {
    const { repositories } = makeRepositories([activeMembership]);

    const result = await resolveViewerState(
      { id: profile.id, email: "seller@solarshare.local" },
      repositories,
    );

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error("Expected a viewer");
    expect(result.viewer.dashboardKind).toBe("seller");
    expect(result.viewer.membership).toEqual(activeMembership);
  });

  it("returns a recoverable unresolved state for a suspended membership", async () => {
    const suspendedMembership: CommunityMembership = {
      ...activeMembership,
      status: "suspended",
    };
    const { repositories, profileRepository, assetRepository } =
      makeRepositories([suspendedMembership]);

    const result = await resolveViewerState(
      { id: profile.id, email: "seller@solarshare.local" },
      repositories,
    );

    expect(result).toEqual({
      status: "unresolved",
      email: "seller@solarshare.local",
      reason: "This account does not have an active community membership.",
    });
    expect(profileRepository.getOwnProfile).not.toHaveBeenCalled();
    expect(assetRepository.listOwned).not.toHaveBeenCalled();
  });

  it("returns a recoverable unresolved state for multiple active memberships", async () => {
    const secondMembership: CommunityMembership = {
      ...activeMembership,
      communityId: "community-2",
      marketAlias: "Second Home",
    };
    const { repositories, profileRepository, assetRepository } =
      makeRepositories([activeMembership, secondMembership]);

    const result = await resolveViewerState(
      { id: profile.id, email: "seller@solarshare.local" },
      repositories,
    );

    expect(result).toEqual({
      status: "unresolved",
      email: "seller@solarshare.local",
      reason: "This account has more than one active community membership.",
    });
    expect(profileRepository.getOwnProfile).not.toHaveBeenCalled();
    expect(assetRepository.listOwned).not.toHaveBeenCalled();
  });

  it.each([
    ["profile", { profile: null }],
    ["community", { community: null }],
  ] as const)(
    "returns a recoverable unresolved state when the %s cannot be resolved",
    async (_missingRecord, overrides) => {
      const { repositories } = makeRepositories([activeMembership], overrides);

      const result = await resolveViewerState(
        { id: profile.id, email: "seller@solarshare.local" },
        repositories,
      );

      expect(result).toEqual({
        status: "unresolved",
        email: "seller@solarshare.local",
        reason: "Your profile or community could not be resolved.",
      });
    },
  );

  it("does not hide unexpected repository failures", async () => {
    const { repositories, communityRepository } = makeRepositories([
      activeMembership,
    ]);
    communityRepository.listOwnMemberships.mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    await expect(
      resolveViewerState(
        { id: profile.id, email: "seller@solarshare.local" },
        repositories,
      ),
    ).rejects.toThrow("Database unavailable");
  });
});
