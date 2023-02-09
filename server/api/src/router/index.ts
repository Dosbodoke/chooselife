import { router } from "../trpc";
import { markerRouter } from "./marker";
import { highlineRouter } from "./highline";

export const appRouter = router({
  marker: markerRouter,
  highline: highlineRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
