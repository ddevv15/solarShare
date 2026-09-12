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

export type DashboardKind = "operator" | "seller" | "buyer";

export type ViewerContext = {
  userId: string;
  email: string;
  profile: Profile;
  membership: CommunityMembership;
  community: Community;
  assets: EnergyAsset[];
  dashboardKind: DashboardKind;
};

export class ViewerAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewerAccessError";
  }
}

type ViewerRepositories = {
  profile: ProfileRepository;
  community: CommunityRepository;
  asset: AssetRepository;
};

export async function resolveViewerContext(
  identity: { id: string; email?: string },
  repositories: ViewerRepositories,
): Promise<ViewerContext> {
  const memberships = await repositories.community.listOwnMemberships();
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active",
  );

  if (activeMemberships.length !== 1) {
    throw new ViewerAccessError(
      "The demo requires exactly one active community membership.",
    );
  }

  const membership = activeMemberships[0];
  const [profile, community, assetPage] = await Promise.all([
    repositories.profile.getOwnProfile(),
    repositories.community.getCommunity(membership.communityId),
    repositories.asset.listOwned(membership.communityId, { limit: 100 }),
  ]);

  if (!profile || !community) {
    throw new ViewerAccessError(
      "Your profile or community could not be resolved.",
    );
  }

  const assets = assetPage.items;
  const hasActiveSolar = assets.some(
    (asset) => asset.assetType === "solar" && asset.status === "active",
  );
  const dashboardKind: DashboardKind =
    membership.memberRole === "operator"
      ? "operator"
      : hasActiveSolar
        ? "seller"
        : "buyer";

  return {
    userId: identity.id,
    email: identity.email ?? "",
    profile,
    membership,
    community,
    assets,
    dashboardKind,
  };
}

export function requireDashboardKind(
  viewer: ViewerContext,
  expected: DashboardKind,
): void {
  if (viewer.dashboardKind !== expected) {
    throw new ViewerAccessError(
      `This area is available to the ${expected} demo account.`,
    );
  }
}
