import { router } from "../trpc";
import { markerRouter } from "./marker";

export const appRouter = router({
  marker: markerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
