export const queryKeys = {
  profile: {
    all: ['profile'] as const,
  },
  membershipApplication: {
    all: ['membership-application'] as const,
    byOrgUser: (
      organizationId: string | undefined,
      userId: string | undefined,
    ) =>
      [...queryKeys.membershipApplication.all, organizationId, userId] as const,
  },
  membershipBilling: {
    all: ['membership-billing'] as const,
    byOrg: (organizationId: string, userId: string | undefined) =>
      [...queryKeys.membershipBilling.all, organizationId, userId] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    bySlug: (slug: string) => [...queryKeys.organizations.all, slug] as const,
    isMember: (
      organizationId: string | undefined,
      userId: string | undefined,
    ) =>
      [
        ...queryKeys.organizations.all,
        'isMember',
        organizationId,
        userId,
      ] as const,
    members: (slug: string, userId: string) =>
      [...queryKeys.organizations.bySlug(slug), 'members', userId] as const,
    memberCount: (slug: string) =>
      [...queryKeys.organizations.bySlug(slug), 'memberCount'] as const,
  },
  news: {
    all: ['news'] as const,
    byOrg: (organizationId: string) =>
      [...queryKeys.news.all, organizationId] as const,
  },
  newsItem: {
    all: ['news-item'] as const,
    byId: (id: string) => [...queryKeys.newsItem.all, id] as const,
  },
};
