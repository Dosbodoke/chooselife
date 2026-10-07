import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { createPhotoFirstImage } from "@/lib/og/photo-first";

export const revalidate = 3600;

export const runtime = "nodejs";

export const alt = "Publicação";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ newsSlug: string; locale: string }>;
}) {
  const { newsSlug } = await params;
  const cleanNewsSlug = newsSlug.split("?")[0].trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("news")
    .select("content, created_at")
    .eq("slug", cleanNewsSlug)
    .single();

  if (error || !data) {
    console.error(`Erro ao buscar notícia ${cleanNewsSlug}:`, error);
  }

  const content = data?.content || "";

  let title = "Ver Publicação";
  const cleanContent = content.trim();
  const headerMatch = cleanContent.match(/^#\s+(.+)$/m);

  if (headerMatch && headerMatch[1]) {
    title = headerMatch[1].replace(/\*\*/g, "").trim();
  }

  const createdAt = data?.created_at;
  let formattedDate = "";
  if (createdAt) {
    formattedDate = new Date(createdAt).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return createPhotoFirstImage({
    title,
    category: "COMUNIDADE",
    details: formattedDate ? [formattedDate] : [],
  });
}
