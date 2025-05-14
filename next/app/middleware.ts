import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/.well-known/apple-app-site-association") {
    const res = NextResponse.next();
    res.headers.set("Content-Type", "application/json");
    return res;
  }

  return NextResponse.next();
}
