import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";

import { getR2PublicUrl } from "@/lib/storage/r2";

export const runtime = "edge";

export const alt = "Highline";
export const size = {
  width: 400,
  height: 210,
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
  const { data, error } = await supabase.rpc("get_highline", {
    searchid: [id],
  });

  if (error || !data?.length) {
    console.error(`Erro ao buscar highline ${id}:`, error);
    return null;
  }

  return data[0] as Highline;
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status}`);
    }

    return response.arrayBuffer();
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
  ].filter(Boolean);
  const backgroundSource = highline?.cover_image
    ? getR2PublicUrl("images", highline.cover_image)
    : `${baseUrl}/highline-og.jpg`;
  const optimizedBackgroundUrl = `${baseUrl}/_next/image?url=${encodeURIComponent(
    backgroundSource
  )}&w=1200&q=75`;
  const backgroundImage = await fetchImageBuffer(optimizedBackgroundUrl);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          backgroundColor: "#141414",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {backgroundImage && (
          <img
            // @ts-expect-error ImageResponse accepts ArrayBuffer image sources.
            src={backgroundImage}
            alt="Highline"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.04) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "20px",
            zIndex: 10,
            width: "100%",
            gap: "8px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              color: "white",
              display: "flex",
              fontSize: 13,
              fontWeight: 800,
              gap: 6,
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "#ef3f35",
                borderRadius: 6,
                display: "flex",
                height: 22,
                justifyContent: "center",
                width: 22,
              }}
            >
              CL
            </div>
            Chooselife
          </div>

          <div
            style={{
              color: "white",
              display: "flex",
              fontSize: title.length > 28 ? 25 : 32,
              fontWeight: 900,
              lineHeight: 1,
              maxWidth: "330px",
              textShadow: "0 3px 12px rgba(0,0,0,0.75)",
            }}
          >
            {title}
          </div>

          {stats.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
              }}
            >
              {stats.map((stat) => (
                <div
                  key={stat}
                  style={{
                    background: "rgba(0,0,0,0.64)",
                    border: "1px solid rgba(255,255,255,0.42)",
                    borderRadius: 999,
                    color: "white",
                    display: "flex",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "5px 8px",
                    textShadow: "0 1px 5px rgba(0,0,0,0.7)",
                  }}
                >
                  {stat}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
