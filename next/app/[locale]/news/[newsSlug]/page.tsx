import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import React, { cache } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createSupabaseClient } from "@/utils/supabase/server";

export const revalidate = 300; // Revalidate every 5 minutes (ISR)

// Initialize Supabase client for static generation (no cookies needed)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseStatic = createClient<Database>(supabaseUrl, supabaseKey);

// Generate static params for ISR
export async function generateStaticParams() {
  const { data: news } = await supabaseStatic
    .from("news")
    .select("slug")
    .order("created_at", { ascending: false })
    .limit(100); // Pre-render the latest 100 news items

  if (!news) return [];

  return news
    .map((item) => ({
      newsSlug: item.slug,
    }))
    .filter((item) => item.newsSlug); // Ensure slug exists
}

const getNewsItem = cache(async (slug: string) => {
  // This function runs at request time (or revalidation time), so cookies() is available
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("news")
    .select(
      "*, organizations(slug), comments:news_comments(*, user:profiles(*))"
    )
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
});

interface NewsDetailPageProps {
  params: Promise<{
    newsSlug: string;
    locale: string;
  }>;
}

// Helper for title extraction
function getTitleFromContent(content: string) {
  const headerMatch = content.match(/^#\s+([^\n]+)/m);
  return headerMatch && headerMatch[1]
    ? headerMatch[1].trim()
    : "Ver Publicação";
}

export async function generateMetadata({
  params,
}: NewsDetailPageProps): Promise<Metadata> {
  const { newsSlug } = await params;
  const news = await getNewsItem(newsSlug);

  const title = getTitleFromContent(news?.content || "");

  return {
    title,
    openGraph: {
      title,
      type: "article",
      publishedTime: news?.created_at,
    },
    twitter: {
      card: "summary_large_image",
      title,
    },
  };
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { newsSlug } = await params;
  const news = await getNewsItem(newsSlug);

  if (!news) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <article className="prose border-x border-dashed p-6 shadow dark:prose-invert lg:prose-xl md:p-10">
        <header className="mb-8">
          <time className="mb-2 block text-sm text-gray-500">
            {new Date(news.created_at).toLocaleDateString()}
          </time>
          {/* Title can be added here if the news table has a title column, using content for now */}
        </header>

        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {news.content}
          </ReactMarkdown>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8">
          <h3 className="mb-6 text-2xl font-bold">
            Comentários ({news.comments?.length || 0})
          </h3>

          <div className="space-y-6">
            {news.comments?.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                  <Image
                    src={
                      comment.user?.profile_picture ||
                      "/default-profile-picture.png"
                    }
                    fill={true}
                    alt="Avatar"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 rounded-lg bg-gray-50 p-4">
                  <div className="mb-1 text-sm font-bold text-gray-900">
                    {comment.user?.username ||
                      comment.user?.name ||
                      "Usuário Desconhecido"}
                  </div>
                  <p className="text-gray-700">{comment.comment}</p>
                </div>
              </div>
            ))}
            {news.comments?.length === 0 && (
              <p className="italic text-gray-500">Nenhum comentário ainda.</p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
