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

  const cleanId = id.split("?")[0].trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Use a Service Key se possível para garantir acesso, senão a anon key
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("news")
    .select("content, created_at")
    .eq("id", cleanId)
    .single();

  if (error || !data) {
    console.error(`Erro ao buscar notícia ${cleanId}:`, error);
  }

  const content = data?.content || "";

  // Extração de título melhorada
  let title = "Ver Publicação";
  const cleanContent = content.trim();
  const headerMatch = cleanContent.match(/^#\s+(.+)$/m);

  if (headerMatch && headerMatch[1]) {
    title = headerMatch[1].replace(/\*\*/g, "").trim();
  }

  // Formatação de data
  const createdAt = data?.created_at;
  let formattedDate = "";

  if (createdAt) {
    formattedDate = new Date(createdAt).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000";

  const bgImageUrl = `${baseUrl}/highline-walk.jpg`;

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
        {/* Background Image */}
        <img
          src={bgImageUrl}
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
    }
  );
}
