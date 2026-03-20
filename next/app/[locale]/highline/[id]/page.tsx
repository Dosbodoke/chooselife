import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next/types";
import { cache } from "react";

import { getHighline } from "@/app/actions/getHighline";
import { getR2PublicUrl } from "@/lib/r2";

import OpenInAPP from "./_components/open-in-app";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getHigh = cache(async ({ id }: { id: string }) => {
  const result = await getHighline({ id: [id] });
  return result.data;
});

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, id } = await params;

  const highlines = await getHigh({ id });

  if (!highlines || highlines.length === 0) {
    return { title: "Highline Not Found" };
  }
  const highline = highlines[0];
  const previousImages = (await parent).openGraph?.images || [];

  const imageUrl = highline.cover_image
    ? getR2PublicUrl("images", highline.cover_image)
    : undefined;

  return {
    title: highline.name || `Highline: ${id}`,
    description: highline.description || "View details about this highline",
    openGraph: {
      title: highline.name || `Highline: ${id}`,
      description:
        highline.description ||
        `Highline with height ${highline.height}m and length ${highline.length}m`,
      url: `/${locale}/${id}`,
      siteName: "ChooseLife",
      images: imageUrl ? [imageUrl, ...previousImages] : previousImages,
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: highline.name || `Highline: ${id}`,
      description:
        highline.description ||
        `Highline with height ${highline.height}m and length ${highline.length}m`,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function Highline({ params }: Props) {
  const { id } = await params;
  const highlines = await getHigh({ id });

  if (!highlines || highlines.length === 0) {
    return notFound();
  }
  const highline = highlines[0];

  return <OpenInAPP highline={highline} />;
}
