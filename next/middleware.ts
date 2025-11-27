import { type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { updateSession } from "@/utils/supabase/middleware"

import { routing } from "./i18n/routing";


export default async function middleware(req: NextRequest) {
  const handleI18nRouting = createIntlMiddleware(routing);
  const res = handleI18nRouting(req);

  const pathname = req.nextUrl.pathname;
  if (pathname === "/.well-known/apple-app-site-association") {
    res.headers.set("Content-Type", "application/json");
    return res;
  }

  return await updateSession(req, res)
}

export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
