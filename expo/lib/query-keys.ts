export const queryKeys = {
  profile: {
    all: ['profile'] as const,
  },
  subscription: {
    all: ['subscription'] as const,
    byOrgUser: (organizationId: string, userId: string) =>
      [...queryKeys.subscription.all, organizationId, userId] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    bySlug: (slug: string) => [...queryKeys.organizations.all, slug] as const,
    members: (slug: string, userId: string) =>
      [...queryKeys.organizations.bySlug(slug), 'members', userId] as const,
    memberCount: (slug: string) =>
      [...queryKeys.organizations.bySlug(slug), 'memberCount'] as const,
  },
};
