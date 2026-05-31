export const festivalKeys = {
  all: ["festival"] as const,
  bySlug: (festivalSlug: string, userId?: string) =>
    [...festivalKeys.all, festivalSlug, { viewerId: userId ?? null }] as const,
};
