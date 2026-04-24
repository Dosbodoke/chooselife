import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import { getR2PublicUrl } from "@/lib/storage/r2";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to fetch highline OG image ${url}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
  const cover = searchParams.get("cover");
  const title = searchParams.get("title") || "Chooselife Highline";
  const height = searchParams.get("height");
  const length = searchParams.get("length");
  const backgroundUrl = cover
    ? getR2PublicUrl("images", cover)
    : `${baseUrl}/highline-og.jpg`;
  const backgroundImage = await fetchImageBuffer(backgroundUrl);
  const stats = [
    height ? `${height}m de altura` : null,
    length ? `${length}m de comprimento` : null,
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: "#141414",
          color: "white",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "flex-end",
          position: "relative",
          width: "100%",
        }}
      >
        {backgroundImage && (
          <img
            // @ts-expect-error ImageResponse accepts an ArrayBuffer source.
            src={backgroundImage}
            alt=""
            style={{
              height: "100%",
              inset: 0,
              objectFit: "cover",
              position: "absolute",
              width: "100%",
            }}
          />
        )}
        <div
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.62) 48%, rgba(0,0,0,0.18) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <div
          style={{
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 56%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: "64px",
            position: "relative",
            width: "790px",
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
              fontSize: title.length > 34 ? 58 : 72,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: "0 4px 24px rgba(0,0,0,0.55)",
            }}
          >
            {title}
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
                    background: "rgba(0,0,0,0.58)",
                    border: "1px solid rgba(255,255,255,0.38)",
                    borderRadius: 999,
                    color: "white",
                    display: "flex",
                    fontSize: 24,
                    fontWeight: 700,
                    padding: "12px 18px",
                    textShadow: "0 2px 8px rgba(0,0,0,0.7)",
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
