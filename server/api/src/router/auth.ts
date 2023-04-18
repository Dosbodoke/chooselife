import { router, protectedProcedure } from "../trpc";

export const authRouter = router({
  upsertProfile: protectedProcedure.mutation(async ({ ctx }) => {
    return await ctx.prisma?.profile.upsert({
      where: { clerkUserId: ctx.userId },
      update: {},
      create: { clerkUserId: ctx.userId },
    });
  }),
});
