import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "News Detail";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("news")
    .select("content, created_at")
    .eq("id", id)
    .single();

  const content = data?.content || "";

  // Extract title: First # header until next blank line
  const lines = content.split("\n");
  let title = "Veja a matéria";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#")) {
      // Remove the # and any extra whitespace
      title = line.replace(/^#+\s*/, "").trim();
      break;
    }
  }

  // Format date
  const createdAt = data?.created_at;
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("pt-BR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000";
  const bgImageUrl = `${baseUrl}/highline-walk.webp`;

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
          backgroundColor: "#1a1a1a",
          position: "relative",
        }}
      >
        <img
          src={bgImageUrl}
          alt="Pessoa andando em um highline"
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
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 80%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "60px",
            zIndex: 10,
            width: "100%",
            gap: "16px",
          }}
        >
          {formattedDate && (
            <div
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 28,
                fontWeight: "normal",
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            >
              {formattedDate}
            </div>
          )}
          <div
            style={{
              color: "white",
              fontSize: 64,
              fontWeight: "bold",
              lineHeight: 1.1,
              textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
