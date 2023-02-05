import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter, createContext } from "./api";

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
