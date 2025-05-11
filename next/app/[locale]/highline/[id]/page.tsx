import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next/types";
import { cache } from "react";

import { getHighline } from "@/app/actions/getHighline";

import HighlineCard from "./_components/HighlineCard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getHigh = cache(async ({ id }: { id: string }) => {
  const result = await getHighline({
    id: [id],
  });
  return result.data;
});

// Generate metadata based on the highline data
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, id } = await params;

  // Fetch highline data
  const highlines = await getHigh({ id });

  // Return default metadata if highline not found
  if (!highlines || highlines.length === 0) {
    return {
      title: "Highline Not Found",
      description: "The requested highline could not be found.",
    };
  }

  const highline = highlines[0];

  // Get parent metadata (optional)
  const previousImages = (await parent).openGraph?.images || [];

  // Get the image URL from Supabase if cover_image exists
  let imageUrl;
  if (highline.cover_image) {
    // Create a server-side supabase client to get the public URL
    // Note: You might need to extract this logic into a separate utility function
    // that can be used both in metadata generation and in your component
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      imageUrl = `${supabaseUrl}/storage/v1/object/public/images/${highline.cover_image}`;
    }
  }

  return {
    title: highline.name || `Highline: ${id}`,
    description: highline.description || "View details about this highline",

    // OpenGraph metadata for social sharing
    openGraph: {
      title: highline.name || `Highline: ${id}`,
      description:
        highline.description ||
        `Highline with height ${highline.height}m and length ${highline.length}m`,
      url: `/${locale}/${id}`,
      siteName: "Highline Explorer",
      images: imageUrl ? [imageUrl, ...previousImages] : previousImages,
      locale: locale,
      type: "website",
    },

    // Twitter card metadata
    twitter: {
      card: "summary_large_image",
      title: highline.name || `Highline: ${id}`,
      description:
        highline.description ||
        `Highline with height ${highline.height}m and length ${highline.length}m`,
      images: imageUrl ? [imageUrl] : [],
    },

    // You can add other metadata properties as needed
    keywords: ["highline", highline.name, highline.status],
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function Highline({ params }: Props) {
  const { id } = await params;

  const highlines = await getHigh({ id });

  if (!highlines || highlines.length === 0) return notFound();
  const highline = highlines[0];

  return <HighlineCard highline={highline} />;
}
