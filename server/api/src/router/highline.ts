import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";

const anchor = z.object({
  latitude: z.number(),
  longitude: z.number(),
  description: z.string(),
});

export const highlineRouter = router({
  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      return await ctx.prisma?.highline.findUnique({ where: { uuid: input } });
    }),
  createHighline: publicProcedure
    .input(
      z.object({
        name: z.string(),
        height: z.number(),
        length: z.number(),
        isRigged: z.boolean(),
        anchorA: anchor,
        anchorB: anchor,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const highline = await ctx.prisma?.highline.create({
        data: {
          name: input.name,
          height: input.height,
          length: input.length,
          isRigged: input.isRigged,
          anchors: {
            createMany: {
              data: [
                {
                  description: input.anchorA.description,
                  anchorSide: "A",
                  latitude: input.anchorA.latitude,
                  longitude: input.anchorA.longitude,
                },
                {
                  description: input.anchorB.description,
                  anchorSide: "B",
                  latitude: input.anchorB.latitude,
                  longitude: input.anchorB.longitude,
                },
              ],
            },
          },
        },
      });
      return highline;
    }),
  checkIsFavorited: protectedProcedure
    .input(z.object({ highlineId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const isFavorite = await ctx.prisma?.favoritedHighline.findUnique({
        where: {
          profileId_highlineId: {
            profileId: ctx.userId,
            highlineId: input.highlineId,
          },
        },
      });
      return !!isFavorite;
    }),
  favorite: protectedProcedure
    .input(z.object({ highlineId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma?.favoritedHighline.create({
        data: {
          profileId: ctx.userId,
          highlineId: input.highlineId,
        },
      });
    }),
  unfavorite: protectedProcedure
    .input(z.object({ highlineId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma?.favoritedHighline.delete({
        where: {
          profileId_highlineId: {
            profileId: ctx.userId,
            highlineId: input.highlineId,
          },
        },
      });
    }),
  getList: publicProcedure
    .input(
      z.object({
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).nullish(),
        skip: z.number().optional(),
        nameFilter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      console.log("CALLED");
      const { skip, cursor, nameFilter } = input;
      const limit = input.limit ?? 50;
      const items = await ctx.prisma?.highline.findMany({
        take: limit + 1, // get an extra item at the end which we'll use as next cursor
        skip,
        where: {
          name: {
            contains: nameFilter,
            mode: "insensitive",
          },
        },
        cursor: cursor ? { uuid: cursor } : undefined,
      });
      let nextCursor: typeof cursor | undefined = undefined;
      if (items && items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.uuid;
      }
      return {
        items,
        nextCursor,
      };
    }),
});
