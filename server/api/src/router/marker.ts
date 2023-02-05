import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const markerRouter = router({
  all: publicProcedure.query(({ ctx }) => {
    const prismaData = ctx.prisma?.highlineAnchor.findMany({
      where: { anchorSide: "A" },
    });
    console.log({ prismaData });
    return prismaData;
  }),
  foo: publicProcedure.query(({ ctx }) => {
    return "fooMessage";
  }),
});
