import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const markerRouter = router({
  all: publicProcedure.query(({ ctx }) => {
    const prismaData = ctx.prisma?.highline.findMany({
      select: {
        uuid: true,
        anchors: {
          select: {
            latitude: true,
            longitude: true,
            anchorSide: true,
          },
        },
      },
    });
    return prismaData;
  }),
});
