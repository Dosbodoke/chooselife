import { inferAsyncReturnType } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import connectDB from "../../prisma/prisma";

connectDB();

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({ req, res, prisma });

export type Context = inferAsyncReturnType<typeof createContext>;
