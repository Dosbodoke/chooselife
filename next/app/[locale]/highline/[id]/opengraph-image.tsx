import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { createPhotoFirstImage } from "@/lib/og/photo-first";

import { isUuid } from "@/lib/highline-url";
import { getR2PublicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

export const alt = "Highline";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

type Highline = {
  cover_image: string | null;
  created_at: string | null;
  height: number | null;
  length: number | null;
  name: string | null;
};

function getBaseUrl() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return process.env.NEXT_PUBLIC_BASE_URL || "https://chooselife.club";
}

async function getHighlineForOg(id: string): Promise<Highline | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.rpc(
    "get_highline",
    isUuid(id)
      ? { searchid: [id] }
      : { searchslug: decodeURIComponent(id).toLowerCase() }
  );

  if (error || !data?.length) {
    console.error(`Erro ao buscar highline ${id}:`, error);
    return null;
  }

  return data[0] as Highline;
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const baseUrl = getBaseUrl();
  const highline = await getHighlineForOg(id);
  const title = highline?.name || "Chooselife Highline";
  const stats = [
    highline?.height ? `${Math.round(highline.height)}m de altura` : null,
    highline?.length ? `${Math.round(highline.length)}m de comprimento` : null,
  ].filter((stat): stat is string => stat !== null);
  const backgroundSource = highline?.cover_image
    ? getR2PublicUrl("images", highline.cover_image)
    : null;
  const backgroundImage = backgroundSource
    ? await fetchImageDataUrl(
        `${baseUrl}/_next/image?url=${encodeURIComponent(
          backgroundSource
        )}&w=1200&q=75`
      )
    : null;

  return createPhotoFirstImage({
    title,
    category: "HIGHLINE",
    details: stats,
    background: backgroundImage,
  });
}
