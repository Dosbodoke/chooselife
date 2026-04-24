import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";

import { getR2PublicUrl } from "@/lib/storage/r2";

export const runtime = "edge";

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
  id: string;
  name: string | null;
  description: string | null;
  height: number | null;
  length: number | null;
  cover_image: string | null;
};

async function getHighlineForOg(id: string): Promise<Highline | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.rpc("get_highline", {
    searchid: [id],
  });

  if (error || !data?.length) {
    console.error(`Failed to load highline OG data for ${id}:`, error);
    return null;
  }

  return data[0] as Highline;
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to fetch OG image asset ${url}:`, error);
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const highline = await getHighlineForOg(id);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://chooselife.club";
  const title = highline?.name || "Chooselife Highline";
  const description =
    highline?.description ||
    "Veja detalhes, registre seu role e acompanhe a historia dessa highline.";
  const stats = [
    highline?.height ? `${Math.round(highline.height)}m de altura` : null,
    highline?.length ? `${Math.round(highline.length)}m de comprimento` : null,
  ].filter(Boolean);
  const backgroundUrl = highline?.cover_image
    ? getR2PublicUrl("images", highline.cover_image)
    : `${baseUrl}/highline-og.jpg`;
  const backgroundImage = await fetchImageBuffer(backgroundUrl);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          backgroundColor: "#141414",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {backgroundImage && (
          <img
            // @ts-expect-error ImageResponse accepts an ArrayBuffer source.
            src={backgroundImage}
            alt=""
            style={{
              height: "100%",
              width: "100%",
              objectFit: "cover",
              position: "absolute",
              inset: 0,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.62) 48%, rgba(0,0,0,0.18) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 55%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: "64px",
            position: "relative",
            width: "780px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 14,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "#ef3f35",
                borderRadius: 10,
                display: "flex",
                height: 48,
                justifyContent: "center",
                width: 48,
              }}
            >
              CL
            </div>
            Chooselife
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: title.length > 34 ? 58 : 72,
                fontWeight: 900,
                lineHeight: 1,
                textShadow: "0 4px 24px rgba(0,0,0,0.55)",
              }}
            >
              {title}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.88)",
                display: "flex",
                fontSize: 30,
                lineHeight: 1.25,
                maxHeight: 116,
                overflow: "hidden",
              }}
            >
              {description}
            </div>
          </div>
          {stats.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 12,
              }}
            >
              {stats.map((stat) => (
                <div
                  key={stat}
                  style={{
                    background: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.28)",
                    borderRadius: 999,
                    color: "white",
                    display: "flex",
                    fontSize: 24,
                    fontWeight: 700,
                    padding: "12px 18px",
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}
