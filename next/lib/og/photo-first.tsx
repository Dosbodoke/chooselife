import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogImageSize = { width: 1200, height: 630 };

const regularFont = readFile(
  join(process.cwd(), "assets/og/Geist-Regular.ttf")
);
const boldFont = readFile(join(process.cwd(), "assets/og/Geist-Bold.ttf"));
const fallbackPhoto = readFile(join(process.cwd(), "public/highline-og.jpg"));

type PhotoFirstImageProps = {
  title: string;
  category: "HIGHLINE" | "COMUNIDADE";
  details: string[];
  background?: string | null;
};

export async function createPhotoFirstImage({
  title,
  category,
  details,
  background,
}: PhotoFirstImageProps) {
  const [regular, bold, fallback] = await Promise.all([
    regularFont,
    boldFont,
    background ? null : fallbackPhoto,
  ]);
  const source =
    background || `data:image/jpeg;base64,${fallback!.toString("base64")}`;
  const displayTitle = title.trim().replace(/\s+/g, " ");
  const boundedTitle =
    displayTitle.length > 160
      ? `${displayTitle.slice(0, 157).trimEnd()}…`
      : displayTitle;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#171b18",
          padding: 56,
          justifyContent: "space-between",
          fontFamily: "Geist",
        }}
      >
        {/* ImageResponse embeds this image directly into the generated PNG. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.12) 85%)",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "white",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                background: "#ef3f35",
                color: "white",
                fontSize: 26,
              }}
            >
              CL
            </div>
            Chooselife
          </div>
          <div
            style={{
              display: "flex",
              color: "white",
              fontSize: 23,
              border: "1px solid #ffffff88",
              padding: "10px 20px",
              borderRadius: 40,
            }}
          >
            {category}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "white",
              fontSize:
                boundedTitle.length > 100
                  ? 48
                  : boundedTitle.length > 48
                  ? 64
                  : 84,
              lineHeight: 1.04,
              fontWeight: 700,
              maxWidth: 1000,
            }}
          >
            {boundedTitle}
          </div>
          {details.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 28,
                color: "white",
                fontSize: 25,
                flexWrap: "wrap",
              }}
            >
              {details.map((detail) => (
                <div key={detail} style={{ display: "flex" }}>
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...ogImageSize,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    }
  );
}
