import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { getR2PublicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function splitTitle(title: string): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > 24 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(`Failed to fetch highline OG image ${url}:`, error);
    return null;
  }
}

function createOverlaySvg({
  title,
  height,
  length,
}: {
  title: string;
  height: string | null;
  length: string | null;
}): Buffer {
  const titleLines = splitTitle(title);
  const titleFontSize = title.length > 34 ? 58 : 72;
  const titleStartY = 420 - (titleLines.length - 1) * titleFontSize * 0.58;
  const stats = [
    height ? `${height}m de altura` : null,
    length ? `${length}m de comprimento` : null,
  ].filter(Boolean) as string[];
  const chipY = titleStartY + titleLines.length * titleFontSize + 28;
  let chipX = 64;

  const chips = stats
    .map((stat) => {
      const width = stat.length * 13.5 + 42;
      const svg = `
        <rect x="${chipX}" y="${chipY}" width="${width}" height="58" rx="29"
          fill="rgba(0,0,0,0.66)" stroke="rgba(255,255,255,0.45)" />
        <text x="${chipX + 21}" y="${chipY + 38}" font-size="24" font-weight="700"
          fill="#fff">${escapeSvg(stat)}</text>
      `;

      chipX += width + 14;
      return svg;
    })
    .join("");

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(0,0,0,0.88)" />
          <stop offset="48%" stop-color="rgba(0,0,0,0.62)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.18)" />
        </linearGradient>
        <linearGradient id="bottom" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="rgba(0,0,0,0.72)" />
          <stop offset="56%" stop-color="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="rgba(0,0,0,0.65)" />
        </filter>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#side)" />
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottom)" />
      <g filter="url(#shadow)" font-family="Arial, Helvetica, sans-serif">
        <rect x="64" y="340" width="48" height="48" rx="10" fill="#ef3f35" />
        <text x="74" y="374" font-size="28" font-weight="800" fill="#fff">CL</text>
        <text x="126" y="374" font-size="28" font-weight="800" fill="#fff">Chooselife</text>
        ${titleLines
          .map(
            (line, index) => `
              <text x="64" y="${titleStartY + index * titleFontSize * 1.03}"
                font-size="${titleFontSize}" font-weight="900" fill="#fff">${escapeSvg(line)}</text>
            `
          )
          .join("")}
        ${chips}
      </g>
    </svg>
  `);
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
  const overlay = createOverlaySvg({ title, height, length });
  const image = await sharp(backgroundImage || undefined, {
    failOn: "none",
  })
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({
      mozjpeg: true,
      progressive: true,
      quality: 82,
    })
    .toBuffer();

  return new NextResponse(image, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": image.byteLength.toString(),
      "Content-Type": "image/jpeg",
    },
  });
}
