import { router, publicProcedure } from "../trpc";
import { z } from "zod";

const anchor = z.object({
  latitude: z.number(),
  longitude: z.number(),
  description: z.string(),
});

export const highlineRouter = router({
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
    .mutation(({ input, ctx }) => {
      ctx.prisma?.highline.create({
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
    }),
});
