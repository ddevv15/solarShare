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

export type ViewerState =
  | { status: "anonymous" }
  | { status: "resolved"; viewer: ViewerContext }
  | { status: "unresolved"; email: string; reason: string };

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

export async function resolveViewerState(
  identity: { id: string; email?: string } | null,
  repositories: ViewerRepositories,
): Promise<ViewerState> {
  if (!identity) return { status: "anonymous" };

  try {
    const viewer = await resolveViewerContext(identity, repositories);

    return { status: "resolved", viewer };
  } catch (error) {
    if (!(error instanceof ViewerAccessError)) throw error;

    return {
      status: "unresolved",
      email: identity.email ?? "",
      reason: error.message,
    };
  }
}

export async function resolveViewerContext(
  identity: { id: string; email?: string },
  repositories: ViewerRepositories,
): Promise<ViewerContext> {
  const memberships = await repositories.community.listOwnMemberships();
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active",
  );

  if (activeMemberships.length === 0) {
    throw new ViewerAccessError(
      "This account does not have an active community membership.",
    );
  }

  if (activeMemberships.length > 1) {
    throw new ViewerAccessError(
      "This account has more than one active community membership.",
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
