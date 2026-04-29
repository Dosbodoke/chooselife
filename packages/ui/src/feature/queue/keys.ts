export const queueKeys = {
  all: ["festival-queue"] as const,
  bySlug: (festivalSlug: string) => [...queueKeys.all, festivalSlug] as const,
};
