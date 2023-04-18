import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";

import { appRouter } from "./src/router";
export type { AppRouter } from "./src/router";

import { createContext } from "./src/context";
export type { Context } from "./src/context";

const app = express();

app.use(
  cors({
    origin: ["*"],
  })
);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.listen(3000, () => {
  console.log("🚀 Server listening on port 3000");
});
