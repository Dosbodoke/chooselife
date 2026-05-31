export const queryKeys = {
  profile: {
    all: ['profile'] as const,
  },
  subscription: {
    all: ['subscription'] as const,
    byOrgUser: (organizationId: string, userId: string) =>
      [
        ...queryKeys.subscription.all,
        { organizationId, viewerId: userId },
      ] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    bySlug: (slug: string) => [...queryKeys.organizations.all, slug] as const,
    isMember: (
      organizationSlug: string | undefined,
      userId: string | undefined,
    ) =>
      [
        ...queryKeys.organizations.all,
        'isMember',
        {
          organizationSlug: organizationSlug ?? null,
          viewerId: userId ?? null,
        },
      ] as const,
    members: (slug: string, userId: string) =>
      [
        ...queryKeys.organizations.bySlug(slug),
        'members',
        { viewerId: userId },
      ] as const,
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
