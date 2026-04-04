import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://chooselife.club";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/notifications/", "/delete/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
