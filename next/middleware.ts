import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { getAgentHomeMarkdown, resolveAgentLocale } from "./lib/agent-content";
import { negotiateRepresentation } from "./lib/accept";
import { updateSession } from "@/utils/supabase/middleware";

import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

function appendVary(headers: Headers, ...values: string[]) {
  const existingValues = (headers.get("Vary") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set(existingValues.map((value) => value.toLowerCase()));

  for (const value of values) {
    if (!seen.has(value.toLowerCase())) {
      existingValues.push(value);
      seen.add(value.toLowerCase());
    }
  }

  headers.set("Vary", existingValues.join(", "));
}

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isHomepage(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  return (
    normalizedPathname === "/" ||
    normalizedPathname === "/pt" ||
    normalizedPathname === "/en"
  );
}

function getHomepageLocale(pathname: string) {
  const firstSegment = normalizePathname(pathname).split("/")[1];
  return resolveAgentLocale(firstSegment);
}

function getBaseUrl(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin).replace(
    /\/+$/,
    "",
  );
}

export default async function middleware(req: NextRequest) {
  const isRscRequest = req.headers.has("RSC");
  if (isHomepage(req.nextUrl.pathname) && !isRscRequest) {
    const representation = negotiateRepresentation(req.headers.get("accept"));

    if (representation === "markdown") {
      return new NextResponse(
        getAgentHomeMarkdown(
          getHomepageLocale(req.nextUrl.pathname),
          getBaseUrl(req),
        ),
        {
          headers: {
            "Cache-Control": "public, max-age=300, s-maxage=300",
            "Content-Type": "text/markdown; charset=utf-8",
            Vary: "Accept, Accept-Encoding",
          },
        },
      );
    }

    if (representation === "not-acceptable") {
      return new NextResponse(
        "# Not acceptable\n\nChooselife serves this page as HTML or Markdown. Request `text/html` or `text/markdown`.",
        {
          status: 406,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/markdown; charset=utf-8",
            Vary: "Accept, Accept-Encoding",
          },
        },
      );
    }
  }

  const res = handleI18nRouting(req);
  appendVary(res.headers, "Accept", "Accept-Encoding");

  const pathname = req.nextUrl.pathname;
  if (pathname === "/.well-known/apple-app-site-association") {
    res.headers.set("Content-Type", "application/json");
    return res;
  }

  const response = await updateSession(req, res);
  appendVary(response.headers, "Accept", "Accept-Encoding");
  return response;
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
