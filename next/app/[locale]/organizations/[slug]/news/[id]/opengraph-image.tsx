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

  // CORREÇÃO CRÍTICA 1: Use a Service Role Key para ignorar RLS (permissões).
  // A chave pública (anon) muitas vezes falha se não houver política pública configurada.
  // Certifique-se de adicionar SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente da Vercel.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("news")
    .select("content, created_at")
    .eq("id", id)
    .single();

  // Debug: Se isso aparecer nos logs da Vercel, sabemos que a query falhou
  if (error || !data) {
    console.error(`Erro ao buscar notícia ${id}:`, error);
  }

  const content = data?.content || "";

  // Extração de título melhorada
  let title = "Ver Publicação";

  // Remove frontmatter se existir ou espaços em branco iniciais antes de tentar o match
  const cleanContent = content.trim();

  // Regex ajustado:
  // ^#\s+ : Começa com # e espaço
  // (.+)  : Captura qualquer coisa (o título)
  // O flag 'm' (multiline) é essencial.
  const headerMatch = cleanContent.match(/^#\s+(.+)$/m);

  if (headerMatch && headerMatch[1]) {
    // Remove caracteres markdown extras que possam ter sobrado (ex: **bold** dentro do título)
    title = headerMatch[1].replace(/\*\*/g, "").trim();
  }

  // Formatação de data
  const createdAt = data?.created_at;
  let formattedDate = "";

  if (createdAt) {
    // Forçamos o locale pt-BR e garantimos que a data seja interpretada corretamente
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

        {/* Gradient Overlay - Ajustado para legibilidade */}
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
                color: "#e5e5e5", // Levemente off-white para contraste hierárquico
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
              // Opcional: Se quiser cortar textos MUITO longos para não estourar a imagem:
              maxHeight: "80%", // Limita a altura
              overflow: "hidden",
              textOverflow: "ellipsis",
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
