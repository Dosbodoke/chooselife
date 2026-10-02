import { NextResponse } from "next/server";

function notFoundResponse(request: Request) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
  ).replace(/\/+$/, "");
  const message = `# Page not found

This Chooselife URL does not exist.

For discoverable resources, see:

- [Sitemap](${baseUrl}/sitemap.xml)
- [Agent index](${baseUrl}/llms.txt)
`;

  return new NextResponse(request.method === "HEAD" ? null : message, {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

export function GET(request: Request) {
  return notFoundResponse(request);
}

export function HEAD(request: Request) {
  return notFoundResponse(request);
}
