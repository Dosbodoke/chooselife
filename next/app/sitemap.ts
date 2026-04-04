import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

import { locales } from "@/i18n/routing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://chooselife.club";

  const staticRoutes = ["", "/festival", "/events", "/download", "/privacy"];

  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  for (const route of staticRoutes) {
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = `${baseUrl}/${locale}${route}`;
    }

    entries.push({
      url: `${baseUrl}/pt${route}`,
      lastModified: new Date(),
      alternates: {
        languages,
      },
    });
  }

  // News/blog posts
  const { data: news } = await supabase
    .from("news")
    .select("slug, created_at")
    .order("created_at", { ascending: false });

  if (news) {
    for (const post of news) {
      if (!post.slug) continue;

      const languages: Record<string, string> = {};
      for (const locale of locales) {
        languages[locale] = `${baseUrl}/${locale}/news/${post.slug}`;
      }

      entries.push({
        url: `${baseUrl}/pt/news/${post.slug}`,
        lastModified: new Date(post.created_at),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages,
        },
      });
    }
  }

  return entries;
}
