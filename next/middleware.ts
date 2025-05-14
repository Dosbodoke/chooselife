import { type CookieOptions } from "@supabase/ssr";
import { getCookie, setCookie } from "cookies-next";
import { type NextRequest, type NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

import { composeDbServerClient } from "@/utils/supabase/compose-db-server-client";

/**
 * Function that returns an object with methods for handling cookies. Can be used as an argument to the createDbServerClient method in server scenarios.
 */
export const composeDbReqResClient = (req: NextRequest, res: NextResponse) => {
  return composeDbServerClient({
    cookieMethods: () => ({
      get(name: string) {
        return getCookie(name, { req, res });
      },
      set(name: string, value: string, options: CookieOptions) {
        return setCookie(name, value, { req, res, ...options });
      },
      remove(name: string, options: CookieOptions) {
        return setCookie(name, "", { req, res, ...options });
      },
    }),
  });
};

export default async function middleware(req: NextRequest) {
  const handleI18nRouting = createIntlMiddleware(routing);
  const res = handleI18nRouting(req);

  const { dbServerClient } = composeDbReqResClient(req, res);
  await dbServerClient.auth.getSession(); // automatically refreshes the session if expired

  const pathname = req.nextUrl.pathname;
  if (pathname === "/.well-known/apple-app-site-association") {
    res.headers.set("Content-Type", "application/json");
    return res;
  }

  return res;
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
