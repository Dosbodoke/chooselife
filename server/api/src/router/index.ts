import { router } from "../trpc";
import { markerRouter } from "./marker";
import { highlineRouter } from "./highline";
import { authRouter } from "./auth";

export const appRouter = router({
  marker: markerRouter,
  highline: highlineRouter,
  auth: authRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
