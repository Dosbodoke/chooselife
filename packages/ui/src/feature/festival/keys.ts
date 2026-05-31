export const festivalKeys = {
  all: ["festival"] as const,
  bySlug: (festivalSlug: string, userId?: string) =>
    [...festivalKeys.all, festivalSlug, "viewer", userId ?? "public"] as const,
  publicBySlug: (festivalSlug: string) =>
    [...festivalKeys.all, festivalSlug, "viewer", "public"] as const,
};
