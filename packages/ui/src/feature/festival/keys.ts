export const festivalKeys = {
  all: ["festival"] as const,
  bySlug: (festivalSlug: string) => [...festivalKeys.all, festivalSlug] as const,
};
