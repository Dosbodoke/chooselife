import { Database } from "@chooselife/database";
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";

export const revalidate = 3600;

export const runtime = "edge";

export const alt = "Publicação";
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
  const cleanId = id.split("?")[0].trim();

  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const bgImagePromise = fetch(`${baseUrl}/highline-og.jpg`).then((res) => {
    if (!res.ok) throw new Error("Failed to load background image");
    return res.arrayBuffer();
  });

  const newsPromise = supabase
    .from("news")
    .select("content, created_at")
    .eq("id", cleanId)
    .single();

  const [bgImageBuffer, { data, error }] = await Promise.all([
    bgImagePromise.catch((e) => {
      console.error(e);
      return null;
    }),
    newsPromise,
  ]);

  if (error || !data) {
    console.error(`Erro ao buscar notícia ${cleanId}:`, error);
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
          fontFamily: "sans-serif",
        }}
      >
        {/* Renderiza a imagem do Buffer se existir, senão fica fundo preto */}
        {bgImageBuffer && (
          <img
            src={bgImageBuffer as any}
            alt="Background"
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

        {/* Gradient Overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Content Container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "60px",
            zIndex: 10,
            width: "100%",
            gap: "10px",
          }}
        >
          {formattedDate && (
            <div
              style={{
                color: "#e5e5e5",
                fontSize: 24,
                fontWeight: 500,
                textTransform: "capitalize",
                marginBottom: "8px",
              }}
            >
              {formattedDate}
            </div>
          )}

          <div
            style={{
              color: "white",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.1,
              textShadow: "0 4px 20px rgba(0,0,0,0.8)",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // @ts-ignore: Explicitly tell Next.js to generate a JPEG
      type: 'jpeg',
      headers: {
        // Cache 1 ano. 
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}