import { inferAsyncReturnType } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import clerk from "@clerk/clerk-sdk-node";

import connectDB from "../../prisma/prisma";

connectDB();

export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  async function getUserId() {
    try {
      const token = req.headers["authorization"];
      if (!token) return null;
      const jwt = await clerk.base.verifySessionToken(token);
      const userId = jwt.sub;
      return userId;
    } catch (error) {
      return null;
    }
  }

  const userId = await getUserId();

  return {
    req,
    res,
    prisma,
    userId,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
