import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next/types";
import { cache } from "react";

import { getHighline } from "@/app/actions/getHighline";
import { getR2PublicUrl } from "@/lib/storage/r2";

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
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, id } = await params;

  const highlines = await getHigh({ id });

  if (!highlines || highlines.length === 0) {
    return { title: "Highline Not Found" };
  }
  const highline = highlines[0];

  const imageUrl = highline.cover_image
    ? getR2PublicUrl("images", highline.cover_image)
    : "/highline-og.jpg";

  return {
    title: highline.name || `Highline: ${id}`,
    description: highline.description || "View details about this highline",
    openGraph: {
      title: highline.name || `Highline: ${id}`,
      description:
        highline.description ||
        `Highline with height ${highline.height}m and length ${highline.length}m`,
      url: `/${locale}/highline/${id}`,
      siteName: "ChooseLife",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: highline.name || `Highline: ${id}`,
        },
      ],
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: highline.name || `Highline: ${id}`,
      description:
        highline.description ||
        `Highline with height ${highline.height}m and length ${highline.length}m`,
      images: [imageUrl],
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
